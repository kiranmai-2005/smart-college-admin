import { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Copy, Save, FileText, Sparkles, FileDown, Image } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CollegeSettings } from '@/hooks/useCollegeSettings';

interface DocumentPreviewProps {
  content: string;
  title: string;
  type: 'circular' | 'notice' | 'timetable';
  onSave?: () => Promise<void>;
  saving?: boolean;
  collegeSettings?: CollegeSettings;
}

// Parse [FOOTER_ROW] for three-column aligned footer (NO border above)
const parseFooterRow = (text: string): React.ReactNode | null => {
  const match = text.match(/\[FOOTER_ROW\]([\s\S]*?)\[\/FOOTER_ROW\]/);
  if (!match) return null;
  
  const parts = match[1].trim().split('|').map(p => p.trim());
  if (parts.length !== 3) return null;
  
  return (
    <div 
      key="footer-row" 
      className="flex justify-between items-start mt-6 pt-4"
    >
      <div className="text-left text-xs" style={{ color: '#1e293b', fontFamily: '"Courier New", Courier, monospace' }}>
        {parts[0]}
      </div>
      <div className="text-center text-xs" style={{ color: '#1e293b', fontFamily: '"Courier New", Courier, monospace' }}>
        {parts[1]}
      </div>
      <div className="text-right text-xs font-bold" style={{ color: '#1e293b', fontFamily: '"Courier New", Courier, monospace' }}>
        {parts[2]}
      </div>
    </div>
  );
};

// Parse [TABLE]...[/TABLE] format and convert to HTML tables
const parseContentWithTables = (content: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let remaining = content;
  let tableIndex = 0;

  // First check for footer row and remove it from content to process separately
  let footerRow: React.ReactNode | null = null;
  if (remaining.includes('[FOOTER_ROW]')) {
    footerRow = parseFooterRow(remaining);
    remaining = remaining.replace(/\[FOOTER_ROW\][\s\S]*?\[\/FOOTER_ROW\]/g, '');
  }

  while (remaining.includes('[TABLE]')) {
    const tableStart = remaining.indexOf('[TABLE]');
    const tableEnd = remaining.indexOf('[/TABLE]');

    if (tableEnd === -1) break;

    // Add text before table
    const textBefore = remaining.substring(0, tableStart);
    if (textBefore.trim()) {
      parts.push(
        <pre 
          key={`text-${tableIndex}`} 
          className="whitespace-pre-wrap text-sm leading-relaxed mb-4"
          style={{ 
            color: '#1e293b', 
            backgroundColor: 'transparent',
            fontFamily: '"Courier New", Courier, monospace'
          }}
        >
          {textBefore}
        </pre>
      );
    }

    // Parse table content
    const tableContent = remaining.substring(tableStart + 7, tableEnd).trim();
    const rows = tableContent.split('\n').filter(row => row.trim());

    if (rows.length > 0) {
      const headerRow = rows[0].split('|').map(cell => cell.trim());
      const dataRows = rows.slice(1).map(row => 
        row.split('|').map(cell => cell.trim())
      );

      parts.push(
        <div key={`table-${tableIndex}`} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse" style={{ borderColor: '#003366' }}>
            <thead>
              <tr style={{ backgroundColor: '#003366' }}>
                {headerRow.map((cell, i) => (
                  <th 
                    key={i} 
                    className="border px-2 py-1 text-left text-xs font-bold uppercase"
                    style={{ 
                      borderColor: '#003366', 
                      color: '#ffffff',
                      fontFamily: '"Courier New", Courier, monospace',
                      fontSize: '10px'
                    }}
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rowIndex) => (
                <tr 
                  key={rowIndex} 
                  style={{ backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#f0f4f8' }}
                >
                  {row.map((cell, cellIndex) => (
                    <td 
                      key={cellIndex} 
                      className="border px-2 py-1 text-xs"
                      style={{ 
                        borderColor: '#003366', 
                        color: '#1e293b',
                        fontFamily: '"Courier New", Courier, monospace',
                        fontSize: '10px'
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    remaining = remaining.substring(tableEnd + 8);
    tableIndex++;
  }

  // Add remaining text after last table
  if (remaining.trim()) {
    parts.push(
      <pre 
        key={`text-final`} 
        className="whitespace-pre-wrap text-sm leading-relaxed"
        style={{ 
          color: '#1e293b', 
          backgroundColor: 'transparent',
          fontFamily: '"Courier New", Courier, monospace'
        }}
      >
        {remaining}
      </pre>
    );
  }

  // Add footer row at the end if it exists
  if (footerRow) {
    parts.push(footerRow);
  }

  return parts;
};

export function DocumentPreview({ content, title, type, onSave, saving, collegeSettings }: DocumentPreviewProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [logoBase64, setLogoBase64] = useState<string>('');

  // Load logo as base64 for PDF/PNG export
  useEffect(() => {
    const loadLogo = async () => {
      const logoUrl = collegeSettings?.logo_url || '/default-logo.png';
      try {
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Failed to load logo:', error);
      }
    };
    loadLogo();
  }, [collegeSettings?.logo_url]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    toast.success('Document copied to clipboard');
  };

  const handleDownloadTxt = () => {
    // Remove [TABLE] markers for plain text download
    const plainContent = content.replace(/\[TABLE\]/g, '').replace(/\[\/TABLE\]/g, '');
    const blob = new Blob([plainContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Document downloaded as TXT');
  };

  // Generate A4-sized HTML for export (both PNG and PDF)
  const generateA4ExportHTML = (): string => {
    // Get college settings or defaults
    const collegeName = collegeSettings?.college_name || "VIGNAN'S INSTITUTE OF ENGINEERING FOR WOMEN";
    const affiliation = collegeSettings?.affiliation || "(Approved by AICTE & Affiliated to JNTU-GV, Vizianagaram) Estd. 2008";
    const accreditation = collegeSettings?.accreditation || "Accredited by NBA for UG Programmes of EEE, ECE, CSE & IT | NAAC A+";
    const certifications = collegeSettings?.certifications || "ISO 9001:2015, ISO 14001:2015, ISO 45001:2018 Certified Institution";

    // Process content for HTML
    let processedContent = content;
    
    // Extract footer row if exists
    let footerRowHTML = '';
    const footerMatch = processedContent.match(/\[FOOTER_ROW\]([\s\S]*?)\[\/FOOTER_ROW\]/);
    if (footerMatch) {
      const parts = footerMatch[1].trim().split('|').map(p => p.trim());
      if (parts.length === 3) {
        footerRowHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 60px; padding-top: 0;">
            <div style="text-align: left; font-size: 24px; color: #1e293b;">${parts[0]}</div>
            <div style="text-align: center; font-size: 24px; color: #1e293b;">${parts[1]}</div>
            <div style="text-align: right; font-size: 24px; color: #1e293b; font-weight: bold;">${parts[2]}</div>
          </div>
        `;
      }
      processedContent = processedContent.replace(/\[FOOTER_ROW\][\s\S]*?\[\/FOOTER_ROW\]/g, '');
    }

    // Convert tables
    let tableIndex = 0;
    while (processedContent.includes('[TABLE]')) {
      const tableStart = processedContent.indexOf('[TABLE]');
      const tableEnd = processedContent.indexOf('[/TABLE]');
      if (tableEnd === -1) break;

      const tableContent = processedContent.substring(tableStart + 7, tableEnd).trim();
      const rows = tableContent.split('\n').filter(row => row.trim());

      if (rows.length > 0) {
        const headerRow = rows[0].split('|').map(cell => cell.trim());
        const dataRows = rows.slice(1).map(row => row.split('|').map(cell => cell.trim()));

        let tableHTML = `<table style="width: 100%; border-collapse: collapse; margin: 30px 0; font-family: 'Courier New', Courier, monospace;">`;
        
        // Header row
        tableHTML += '<thead><tr>';
        headerRow.forEach(cell => {
          tableHTML += `<th style="background-color: #003366; color: #ffffff; border: 2px solid #003366; padding: 12px 16px; text-align: left; font-size: 22px; font-weight: bold; text-transform: uppercase;">${cell}</th>`;
        });
        tableHTML += '</tr></thead>';

        // Data rows
        tableHTML += '<tbody>';
        dataRows.forEach((row, rowIdx) => {
          const bgColor = rowIdx % 2 === 0 ? '#ffffff' : '#f0f4f8';
          tableHTML += `<tr style="background-color: ${bgColor};">`;
          row.forEach(cell => {
            tableHTML += `<td style="border: 2px solid #003366; padding: 12px 16px; font-size: 22px; color: #1e293b;">${cell}</td>`;
          });
          tableHTML += '</tr>';
        });
        tableHTML += '</tbody></table>';

        processedContent = processedContent.substring(0, tableStart) + tableHTML + processedContent.substring(tableEnd + 8);
      }
      tableIndex++;
    }

    // Convert text content - process line by line
    const lines = processedContent.split('\n');
    let htmlContent = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip if it's already an HTML table
      if (trimmedLine.startsWith('<table') || trimmedLine.includes('</table>')) {
        htmlContent += line + '\n';
        continue;
      }
      
      // Check if it's a heading (uppercase text)
      const isHeading = trimmedLine === trimmedLine.toUpperCase() && 
                       trimmedLine.length > 3 && 
                       /[A-Z]/.test(trimmedLine) &&
                       !trimmedLine.startsWith('<');
      
      if (isHeading && (
        trimmedLine.includes('TIME TABLE') ||
        trimmedLine.includes('CIRCULAR') ||
        trimmedLine.includes('NOTICE') ||
        trimmedLine.includes('EXAMINATION') ||
        trimmedLine.includes('NOTES') ||
        trimmedLine.includes('HAPPY')
      )) {
        htmlContent += `<div style="text-align: center; font-weight: bold; font-size: 32px; color: #003366; margin: 30px 0 20px 0;">${trimmedLine}</div>\n`;
      } else if (trimmedLine.startsWith('Ref.No') || trimmedLine.startsWith('Date:')) {
        htmlContent += `<div style="font-size: 24px; color: #1e293b; margin: 8px 0;">${line}</div>\n`;
      } else if (trimmedLine.match(/^\d+\./)) {
        // Numbered list item
        htmlContent += `<div style="font-size: 24px; color: #1e293b; margin: 12px 0; padding-left: 20px;">${line}</div>\n`;
      } else if (trimmedLine) {
        htmlContent += `<div style="font-size: 24px; color: #1e293b; margin: 8px 0; line-height: 1.6;">${line}</div>\n`;
      } else {
        htmlContent += `<div style="height: 16px;"></div>\n`;
      }
    }

    // Build the complete A4 document HTML
    // A4 at 300 DPI: 2480 x 3508 pixels
    // Using 80% content width = ~1984px content area with ~248px margins each side
    const a4HTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Courier New', Courier, monospace;
            background: #ffffff;
          }
          
          .a4-page {
            width: 2480px;
            min-height: 3508px;
            background: #ffffff;
            position: relative;
            padding: 0;
          }
          
          .page-border {
            position: absolute;
            top: 60px;
            left: 60px;
            right: 60px;
            bottom: 60px;
            border: 3px solid #000000;
            pointer-events: none;
          }
          
          .page-content {
            padding: 100px 180px;
            min-height: 3508px;
          }
          
          .header {
            text-align: center;
            padding-bottom: 40px;
            border-bottom: 4px solid #003366;
            margin-bottom: 50px;
          }
          
          .header-flex {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 40px;
          }
          
          .logo {
            width: 180px;
            height: 180px;
            object-fit: contain;
          }
          
          .header-text {
            flex: 1;
            text-align: center;
          }
          
          .college-name {
            font-size: 48px;
            font-weight: bold;
            color: #003366;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .affiliation {
            font-size: 24px;
            color: #333333;
            margin-bottom: 8px;
          }
          
          .accreditation {
            font-size: 24px;
            color: #006400;
            font-weight: bold;
            margin-bottom: 8px;
          }
          
          .certifications {
            font-size: 22px;
            color: #555555;
          }
          
          .spacer {
            width: 180px;
            height: 180px;
          }
          
          .content {
            font-family: 'Courier New', Courier, monospace;
          }
        </style>
      </head>
      <body>
        <div class="a4-page">
          <div class="page-border"></div>
          <div class="page-content">
            <!-- Header -->
            <div class="header">
              <div class="header-flex">
                ${logoBase64 ? `<img src="${logoBase64}" class="logo" alt="College Logo" />` : '<div class="spacer"></div>'}
                <div class="header-text">
                  <div class="college-name">${collegeName}</div>
                  <div class="affiliation">${affiliation}</div>
                  <div class="accreditation">${accreditation}</div>
                  <div class="certifications">${certifications}</div>
                </div>
                <div class="spacer"></div>
              </div>
            </div>
            
            <!-- Content -->
            <div class="content">
              ${htmlContent}
              ${footerRowHTML}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return a4HTML;
  };

  const handleDownloadImage = async () => {
    if (!content) {
      toast.error('No document to export');
      return;
    }
    
    const loadingToast = toast.loading('Generating A4 image (2480×3508px)...');
    
    try {
      // A4 dimensions at 300 DPI
      const A4_WIDTH = 2480;
      const A4_HEIGHT = 3508;
      
      // Create hidden container
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = `${A4_WIDTH}px`;
      container.style.height = `${A4_HEIGHT}px`;
      container.style.overflow = 'hidden';
      container.style.backgroundColor = '#ffffff';
      document.body.appendChild(container);

      // Generate and set HTML
      const a4HTML = generateA4ExportHTML();
      container.innerHTML = a4HTML;

      // Wait for content to render and images to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const images = container.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));

      // Find the a4-page element
      const a4Page = container.querySelector('.a4-page') as HTMLElement;
      if (!a4Page) {
        throw new Error('Failed to create A4 page');
      }

      // Capture with html2canvas at 1:1 scale (already at 2480x3508)
      const canvas = await html2canvas(a4Page, {
        backgroundColor: '#ffffff',
        scale: 1,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: A4_WIDTH,
        height: A4_HEIGHT,
        windowWidth: A4_WIDTH,
        windowHeight: A4_HEIGHT
      });

      // Clean up
      document.body.removeChild(container);

      // Create download link
      const link = document.createElement('a');
      link.download = `${title.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.dismiss(loadingToast);
      toast.success('Document downloaded as A4 PNG (2480×3508px)');
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Image generation error:', error);
      toast.error('Failed to generate image. Please try again.');
    }
  };

  const handleDownloadPdf = async () => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const maxWidth = pageWidth - 2 * margin;
    const lineHeight = 5;
    let yPosition = margin;

    // Get college settings or defaults
    const collegeName = collegeSettings?.college_name || "VIGNAN'S INSTITUTE OF ENGINEERING FOR WOMEN";
    const affiliation = collegeSettings?.affiliation || "(Approved by AICTE & Affiliated to JNTU-GV, Vizianagaram) Estd. 2008";
    const accreditation = collegeSettings?.accreditation || "Accredited by NBA for UG Programmes of EEE, ECE, CSE & IT | NAAC A+";
    const certifications = collegeSettings?.certifications || "ISO 9001:2015, ISO 14001:2015, ISO 45001:2018 Certified Institution";

    // Draw page border
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.5);
    pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);

    // Add logo on the left if available
    const logoSize = 18;
    if (logoBase64) {
      try {
        pdf.addImage(logoBase64, 'PNG', margin + 2, yPosition, logoSize, logoSize);
      } catch (e) {
        console.error('Failed to add logo to PDF:', e);
      }
    }

    // College Header - centered between logos
    const headerStartX = margin + logoSize + 5;
    const headerWidth = maxWidth - (2 * logoSize) - 10;
    const headerCenterX = headerStartX + (headerWidth / 2);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(0, 51, 102); // Navy blue for college name
    pdf.text(collegeName, headerCenterX, yPosition + 5, { align: 'center' });
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    yPosition += 7;
    pdf.text(affiliation, headerCenterX, yPosition + 5, { align: 'center' });
    yPosition += 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 100, 0); // Green for accreditation
    pdf.text(accreditation, headerCenterX, yPosition + 5, { align: 'center' });
    yPosition += 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(certifications, headerCenterX, yPosition + 5, { align: 'center' });
    
    yPosition += 12;

    // Add horizontal line after header
    pdf.setDrawColor(0, 51, 102);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Reset text color for content
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(9);
    
    // Process content - parse tables and footer separately
    let remaining = content;
    
    // Extract footer row if exists
    let footerRowContent: string[] | null = null;
    const footerMatch = remaining.match(/\[FOOTER_ROW\]([\s\S]*?)\[\/FOOTER_ROW\]/);
    if (footerMatch) {
      footerRowContent = footerMatch[1].trim().split('|').map(p => p.trim());
      remaining = remaining.replace(/\[FOOTER_ROW\][\s\S]*?\[\/FOOTER_ROW\]/g, '');
    }
    
    while (remaining.length > 0) {
      const tableStart = remaining.indexOf('[TABLE]');
      
      if (tableStart === -1) {
        // No more tables, render remaining text
        const lines = remaining.split('\n');
        for (const line of lines) {
          if (yPosition > pageHeight - margin - 15) {
            pdf.addPage();
            pdf.setDrawColor(0);
            pdf.setLineWidth(0.5);
            pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);
            yPosition = margin + 5;
          }
          
          const trimmedLine = line.trim();
          const isHeading = trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3 && /[A-Z]/.test(trimmedLine);
          
          if (isHeading && (
            trimmedLine.includes('TIME TABLE') ||
            trimmedLine.includes('CIRCULAR') ||
            trimmedLine.includes('NOTICE') ||
            trimmedLine.includes('EXAMINATION') ||
            trimmedLine.includes('HAPPY')
          )) {
            pdf.setFont('courier', 'bold');
            pdf.setFontSize(11);
            pdf.text(line, pageWidth / 2, yPosition, { align: 'center' });
            pdf.setFont('courier', 'normal');
            pdf.setFontSize(9);
          } else if (line.trim()) {
            const splitLines = pdf.splitTextToSize(line, maxWidth);
            for (const splitLine of splitLines) {
              if (yPosition > pageHeight - margin - 15) {
                pdf.addPage();
                pdf.setDrawColor(0);
                pdf.setLineWidth(0.5);
                pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);
                yPosition = margin + 5;
              }
              pdf.text(splitLine, margin, yPosition);
              yPosition += lineHeight;
            }
          } else {
            yPosition += lineHeight / 2;
          }
        }
        break;
      }
      
      // Render text before table
      const textBefore = remaining.substring(0, tableStart);
      const lines = textBefore.split('\n');
      for (const line of lines) {
        if (yPosition > pageHeight - margin - 15) {
          pdf.addPage();
          pdf.setDrawColor(0);
          pdf.setLineWidth(0.5);
          pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);
          yPosition = margin + 5;
        }
        
        const trimmedLine = line.trim();
        const isHeading = trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3 && /[A-Z]/.test(trimmedLine);
        
        if (isHeading) {
          pdf.setFont('courier', 'bold');
          pdf.setFontSize(11);
          pdf.text(line, pageWidth / 2, yPosition, { align: 'center' });
          pdf.setFont('courier', 'normal');
          pdf.setFontSize(9);
          yPosition += lineHeight;
        } else if (line.trim()) {
          const splitLines = pdf.splitTextToSize(line, maxWidth);
          for (const splitLine of splitLines) {
            pdf.text(splitLine, margin, yPosition);
            yPosition += lineHeight;
          }
        } else {
          yPosition += lineHeight / 2;
        }
      }
      
      // Parse and render table
      const tableEnd = remaining.indexOf('[/TABLE]');
      if (tableEnd === -1) break;
      
      const tableContent = remaining.substring(tableStart + 7, tableEnd).trim();
      const rows = tableContent.split('\n').filter(row => row.trim());
      
      if (rows.length > 0) {
        yPosition += 3;
        
        // Calculate column widths
        const allCells = rows.map(row => row.split('|').map(cell => cell.trim()));
        const numCols = Math.max(...allCells.map(row => row.length));
        const colWidth = (maxWidth - 4) / numCols;
        const cellHeight = 6;
        const cellPadding = 2;
        
        // Draw table
        pdf.setFontSize(7);
        
        for (let rowIdx = 0; rowIdx < allCells.length; rowIdx++) {
          const row = allCells[rowIdx];
          
          // Check for new page
          if (yPosition > pageHeight - margin - cellHeight - 10) {
            pdf.addPage();
            pdf.setDrawColor(0);
            pdf.setLineWidth(0.5);
            pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);
            yPosition = margin + 5;
          }
          
          const isHeader = rowIdx === 0;
          
          for (let colIdx = 0; colIdx < numCols; colIdx++) {
            const cellX = margin + 2 + (colIdx * colWidth);
            const cellText = row[colIdx] || '';
            
            // Draw cell background
            if (isHeader) {
              pdf.setFillColor(0, 51, 102);
              pdf.rect(cellX, yPosition, colWidth, cellHeight, 'F');
              pdf.setTextColor(255, 255, 255);
              pdf.setFont('courier', 'bold');
            } else {
              pdf.setFillColor(rowIdx % 2 === 0 ? 255 : 240, rowIdx % 2 === 0 ? 255 : 244, rowIdx % 2 === 0 ? 255 : 248);
              pdf.rect(cellX, yPosition, colWidth, cellHeight, 'F');
              pdf.setTextColor(0, 0, 0);
              pdf.setFont('courier', 'normal');
            }
            
            // Draw cell border
            pdf.setDrawColor(0, 51, 102);
            pdf.setLineWidth(0.2);
            pdf.rect(cellX, yPosition, colWidth, cellHeight);
            
            // Draw cell text (truncate if needed)
            const maxTextWidth = colWidth - (2 * cellPadding);
            let displayText = cellText;
            while (pdf.getTextWidth(displayText) > maxTextWidth && displayText.length > 0) {
              displayText = displayText.slice(0, -1);
            }
            pdf.text(displayText, cellX + cellPadding, yPosition + cellHeight - 2);
          }
          
          yPosition += cellHeight;
        }
        
        yPosition += 5;
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);
      }
      
      remaining = remaining.substring(tableEnd + 8);
    }

    // Render footer row if exists (three-column aligned)
    if (footerRowContent && footerRowContent.length === 3) {
      yPosition += 8;
      
      // Check for new page
      if (yPosition > pageHeight - margin - 15) {
        pdf.addPage();
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.5);
        pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);
      yPosition = margin + 5;
      }
      
      // NO separator line above footer - removed as per user request
      yPosition += 5;
      
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      
      // Left aligned
      pdf.text(footerRowContent[0], margin, yPosition);
      
      // Center aligned
      pdf.text(footerRowContent[1], pageWidth / 2, yPosition, { align: 'center' });
      
      // Right aligned (bold for signature)
      pdf.setFont('courier', 'bold');
      pdf.text(footerRowContent[2], pageWidth - margin, yPosition, { align: 'right' });
    }

    // Save the PDF
    pdf.save(`${title.replace(/\s+/g, '_')}.pdf`);
    toast.success('Document downloaded as PDF');
  };

  // Get college settings for preview header
  const collegeName = collegeSettings?.college_name || "VIGNAN'S INSTITUTE OF ENGINEERING FOR WOMEN";
  const affiliation = collegeSettings?.affiliation || "(Approved by AICTE & Affiliated to JNTU-GV, Vizianagaram) Estd. 2008";
  const accreditation = collegeSettings?.accreditation || "Accredited by NBA for UG Programmes of EEE, ECE, CSE & IT | NAAC A+";
  const certifications = collegeSettings?.certifications || "ISO 9001:2015, ISO 14001:2015, ISO 45001:2018 Certified Institution";
  const logoUrl = collegeSettings?.logo_url || '/default-logo.png';

  if (!content) {
    return (
      <Card className="card-academic h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-5 w-5" />
            Document Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="document-preview flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No Document Generated Yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Fill in the form and click generate to create your {type} document using AI.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const parsedContent = parseContentWithTables(content);

  return (
    <Card className="card-academic h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gold" />
          {title}
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadTxt}>
            <Download className="h-4 w-4 mr-1" />
            TXT
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <FileDown className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadImage}>
            <Image className="h-4 w-4 mr-1" />
            PNG
          </Button>
          {onSave && (
            <Button size="sm" onClick={onSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div 
          ref={contentRef}
          data-document-content
          className="rounded-lg p-6 shadow-inner min-h-[500px] max-h-[700px] overflow-auto"
          style={{ backgroundColor: '#ffffff', border: '2px solid #003366' }}
        >
          {/* Official College Header for Preview/Export */}
          <div className="mb-4 pb-4" style={{ borderBottom: '2px solid #003366' }}>
            <div className="flex items-center justify-center gap-4">
              <img 
                src={logoUrl} 
                alt="College Logo" 
                className="h-16 w-16 object-contain"
                crossOrigin="anonymous"
              />
              <div className="text-center flex-1">
                <h1 
                  className="font-bold text-lg"
                  style={{ color: '#003366' }}
                >
                  {collegeName}
                </h1>
                <p className="text-xs text-gray-700">{affiliation}</p>
                <p className="text-xs font-semibold" style={{ color: '#006400' }}>{accreditation}</p>
                <p className="text-xs text-gray-600">{certifications}</p>
              </div>
              <div className="h-16 w-16" /> {/* Spacer for symmetry */}
            </div>
          </div>
          
          {/* Document Content with parsed tables */}
          <div className="formal-document">
            {parsedContent}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
