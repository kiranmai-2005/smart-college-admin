import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Input validation helpers
function validateString(value: unknown, maxLength: number = 500): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLength).trim();
}

function validateFilePath(filePath: string, userId: string): string {
  // Sanitize path traversal attempts
  const sanitized = filePath
    .replace(/\.\.\//g, '')  // Remove ../ patterns
    .replace(/\.\.\\/g, '')  // Remove ..\\ patterns
    .replace(/^\/+/, '')     // Remove leading slashes
    .trim();
  
  // Verify the file path belongs to the authenticated user
  if (!sanitized.startsWith(`${userId}/`)) {
    throw new Error('Access denied: You can only process your own documents');
  }
  
  return sanitized;
}

function validateMimeType(mimeType: unknown): string {
  const validTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'text/plain',
  ];
  
  if (typeof mimeType !== 'string') {
    return 'application/pdf'; // Default
  }
  
  // Check if it starts with a valid prefix or is in the list
  if (validTypes.includes(mimeType) || mimeType.startsWith('image/')) {
    return mimeType;
  }
  
  return 'application/pdf'; // Default fallback
}

// Sanitize text to remove characters PostgreSQL can't handle
function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u0000/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\uFFFD/g, '') // Remove replacement characters
    .replace(/[\uD800-\uDFFF]/g, '') // Remove unpaired surrogates
    .replace(/\s+/g, ' ')
    .trim();
}

// Simple PDF text extraction (basic implementation)
async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const bytes = new Uint8Array(pdfBuffer);
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    
    // Extract text between parentheses (PDF text objects) and clean up
    const textMatches = text.match(/\(([^)]+)\)/g) || [];
    const extractedText = textMatches
      .map(match => match.slice(1, -1))
      .filter(t => t.length > 2 && /[a-zA-Z]/.test(t))
      .join(' ');
    
    return sanitizeText(extractedText);
  } catch (error) {
    console.error('PDF extraction error:', error);
    return '';
  }
}

// Extract text from DOCX files (they are ZIP archives with XML content)
async function extractTextFromDOCX(docxBuffer: ArrayBuffer): Promise<string> {
  try {
    const bytes = new Uint8Array(docxBuffer);
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    
    // DOCX files contain XML with text in <w:t> tags
    const textMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
    const extractedText = textMatches
      .map(match => {
        const content = match.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '');
        return content;
      })
      .join(' ');
    
    // Also try to extract plain text patterns
    const plainTextMatches = text.match(/[A-Za-z][A-Za-z0-9\s.,!?'-]{10,}/g) || [];
    const combinedText = extractedText + ' ' + plainTextMatches.join(' ');
    
    return sanitizeText(combinedText);
  } catch (error) {
    console.error('DOCX extraction error:', error);
    return '';
  }
}

// For images, we store metadata since OCR would require external service
function getImageMetadata(mimeType: string, fileSize: number): string {
  return sanitizeText(`[Image document - Type: ${mimeType}, Size: ${(fileSize / 1024).toFixed(1)}KB. This is a visual reference document that can be used for formatting and layout guidance.]`);
}

// Split text into chunks for embedding
function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start < 0) break;
  }
  
  return chunks.filter(chunk => chunk.trim().length > 20);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ========== AUTHENTICATION ==========
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create Supabase client with user's token for authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Verify the user's token
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // ========== INPUT VALIDATION ==========
    const body = await req.json();
    
    // Validate filePath - must be a string
    const rawFilePath = validateString(body.filePath, 500);
    if (!rawFilePath) {
      throw new Error("Missing or invalid filePath");
    }
    
    // Validate and sanitize the file path, ensuring it belongs to the authenticated user
    const filePath = validateFilePath(rawFilePath, user.id);
    
    // Use authenticated user's ID, not the client-supplied userId
    const userId = user.id;
    
    // Validate mimeType
    const mimeType = validateMimeType(body.mimeType);
    
    // Validate fileSize (use a reasonable max, e.g., 50MB)
    const fileSize = typeof body.fileSize === 'number' && body.fileSize > 0 && body.fileSize < 52428800 
      ? body.fileSize 
      : 0;

    console.log('Processing document:', filePath, 'for user:', userId);

    // Use service role key for storage operations (after auth verification)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (downloadError) {
      console.error('Download error details:', JSON.stringify(downloadError));
      throw new Error(`Failed to download file: ${downloadError.message || 'Unknown download error'}`);
    }

    if (!fileData) {
      throw new Error('No file data received from storage');
    }

    // Extract text based on file type
    const arrayBuffer = await fileData.arrayBuffer();
    let extractedText = '';
    
    const detectedMimeType = mimeType;
    console.log('Detected type:', detectedMimeType, 'File size:', arrayBuffer.byteLength);
    
    if (detectedMimeType === 'application/pdf') {
      extractedText = await extractTextFromPDF(arrayBuffer);
    } else if (detectedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractedText = await extractTextFromDOCX(arrayBuffer);
    } else if (detectedMimeType.startsWith('image/')) {
      extractedText = getImageMetadata(detectedMimeType, fileSize || arrayBuffer.byteLength);
    } else {
      // Fallback: try to extract as plain text
      try {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(arrayBuffer));
        extractedText = sanitizeText(text.substring(0, 50000));
      } catch (e) {
        extractedText = '[Binary file - content could not be extracted]';
      }
    }
    
    console.log('Extracted text length:', extractedText.length);

    // Ensure we have some text even if extraction failed
    if (!extractedText || extractedText.length === 0) {
      extractedText = `[Document uploaded: ${filePath.split('/').pop() || 'unknown'}]`;
    }

    // Update the document with parsed text
    const { data: docData, error: updateError } = await supabase
      .from('uploaded_documents')
      .update({ 
        parsed_text: extractedText.substring(0, 50000), // Limit stored text
        is_processed: true 
      })
      .eq('file_path', filePath)
      .eq('user_id', userId)
      .select('id')
      .single();

    if (updateError) {
      console.error('Update error:', JSON.stringify(updateError));
      throw new Error(`Failed to update document: ${updateError.message || 'Unknown update error'}`);
    }

    console.log('Document updated successfully, id:', docData?.id);

    // Generate embeddings for chunks if we have meaningful text
    if (extractedText.length > 50 && docData) {
      const chunks = chunkText(extractedText);
      console.log('Generated chunks:', chunks.length);

      for (let i = 0; i < Math.min(chunks.length, 20); i++) {
        const { error: embedError } = await supabase.from('document_embeddings').insert({
          document_id: docData.id,
          chunk_text: sanitizeText(chunks[i]),
          chunk_index: i,
        });
        if (embedError) {
          console.warn('Embedding insert error for chunk', i, ':', embedError.message);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        textLength: extractedText.length,
        message: 'Document processed successfully' 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing document:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
