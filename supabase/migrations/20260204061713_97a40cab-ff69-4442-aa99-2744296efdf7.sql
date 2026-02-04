-- Add missing DELETE and UPDATE policies for document_embeddings table
CREATE POLICY "Users can delete embeddings of their documents"
ON public.document_embeddings FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.uploaded_documents
    WHERE uploaded_documents.id = document_embeddings.document_id
    AND uploaded_documents.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update embeddings of their documents"
ON public.document_embeddings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.uploaded_documents
    WHERE uploaded_documents.id = document_embeddings.document_id
    AND uploaded_documents.user_id = auth.uid()
  )
);

-- Fix match_documents function to enforce user context and prevent RLS bypass
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 5,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  chunk_text text,
  chunk_index integer,
  similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_user_id uuid;
BEGIN
  -- Get effective user ID: use provided p_user_id or fall back to auth.uid()
  effective_user_id := COALESCE(p_user_id, auth.uid());
  
  -- Ensure we have a valid user ID
  IF effective_user_id IS NULL THEN
    RAISE EXCEPTION 'User authentication required to query documents';
  END IF;
  
  -- If p_user_id is provided, verify it matches the authenticated user
  -- This prevents users from querying other users' documents
  IF p_user_id IS NOT NULL AND p_user_id != auth.uid() AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot query other users'' documents';
  END IF;
  
  RETURN QUERY
  SELECT
    de.id,
    de.document_id,
    de.chunk_text,
    de.chunk_index,
    1 - (de.embedding <=> query_embedding) as similarity
  FROM document_embeddings de
  JOIN uploaded_documents ud ON de.document_id = ud.id
  WHERE 
    ud.user_id = effective_user_id  -- Always enforce user filtering
    AND 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;