import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Download, Type, Undo, Redo, FileUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadBlob } from '@/lib/documentProcessor';

const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '48'];
const FONT_FAMILIES = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS'];

const WordEditor = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [fileName, setFileName] = useState('document');
  const [fontSize, setFontSize] = useState('16');
  const [fontFamily, setFontFamily] = useState('Arial');

  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editorRef.current) return;

    const name = file.name.replace(/\.[^.]+$/, '');
    setFileName(name);

    try {
      const ext = file.name.toLowerCase();
      if (ext.endsWith('.txt') || ext.endsWith('.md') || ext.endsWith('.csv')) {
        const text = await file.text();
        editorRef.current.innerHTML = text.split('\n').map(l => `<p>${l || '<br>'}</p>`).join('');
        toast.success(`Loaded: ${file.name}`);
      } else if (ext.endsWith('.doc') || ext.endsWith('.docx')) {
        const mammoth = (await import('mammoth')).default;
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        editorRef.current.innerHTML = result.value;
        toast.success(`Loaded: ${file.name}`);
      } else if (ext.endsWith('.html') || ext.endsWith('.htm')) {
        const html = await file.text();
        editorRef.current.innerHTML = html;
        toast.success(`Loaded: ${file.name}`);
      } else {
        toast.error('Unsupported file type. Use TXT, DOC, DOCX, or HTML.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load file');
    }
  };

  const handleExportDocx = async () => {
    if (!editorRef.current) return;
    try {
      const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');

      const htmlContent = editorRef.current.innerHTML;
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;

      const paragraphs: any[] = [];
      const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (text.trim()) {
            paragraphs.push(
              new Paragraph({
                children: [new TextRun({ text, size: parseInt(fontSize) * 2 })],
              })
            );
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();

          if (tag === 'br') {
            paragraphs.push(new Paragraph({ children: [] }));
            return;
          }

          const text = el.textContent || '';
          if (!text.trim() && !el.children.length) return;

          const isBold = el.style.fontWeight === 'bold' || tag === 'b' || tag === 'strong';
          const isItalic = el.style.fontStyle === 'italic' || tag === 'i' || tag === 'em';
          const isUnderline = el.style.textDecoration?.includes('underline') || tag === 'u';

          let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT;
          if (el.style.textAlign === 'center') alignment = AlignmentType.CENTER;
          if (el.style.textAlign === 'right') alignment = AlignmentType.RIGHT;

          if (tag === 'div' || tag === 'p' || tag === 'h1' || tag === 'h2' || tag === 'h3') {
            const children: any[] = [];
            el.childNodes.forEach(child => {
              const childText = child.textContent || '';
              if (childText) {
                const childEl = child.nodeType === Node.ELEMENT_NODE ? child as HTMLElement : null;
                children.push(new TextRun({
                  text: childText,
                  bold: isBold || childEl?.tagName?.toLowerCase() === 'b' || childEl?.tagName?.toLowerCase() === 'strong',
                  italics: isItalic || childEl?.tagName?.toLowerCase() === 'i' || childEl?.tagName?.toLowerCase() === 'em',
                  underline: (isUnderline || childEl?.tagName?.toLowerCase() === 'u') ? {} : undefined,
                  size: tag.startsWith('h') ? 32 : parseInt(fontSize) * 2,
                }));
              }
            });
            if (children.length === 0) {
              children.push(new TextRun({ text: text, size: parseInt(fontSize) * 2 }));
            }
            paragraphs.push(new Paragraph({ children, alignment }));
          } else if (tag === 'li') {
            paragraphs.push(new Paragraph({
              children: [new TextRun({ text, size: parseInt(fontSize) * 2 })],
              bullet: { level: 0 },
            }));
          } else {
            Array.from(el.childNodes).forEach(processNode);
          }
        }
      };

      Array.from(tempDiv.childNodes).forEach(processNode);
      if (paragraphs.length === 0) {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: ' ' })] }));
      }

      const doc = new Document({ sections: [{ children: paragraphs }] });
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `${fileName || 'document'}.docx`);
      toast.success('Word document exported!');
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    }
  };

  const handleExportPdf = async () => {
    if (!editorRef.current) return;
    try {
      const { PDFDocument } = await import('pdf-lib');
      const text = editorRef.current.innerText || '';
      const pdfDoc = await PDFDocument.create();
      const charsPerPage = 3000;
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += charsPerPage) {
        chunks.push(text.substring(i, i + charsPerPage));
      }
      if (chunks.length === 0) chunks.push(' ');

      for (const chunk of chunks) {
        const page = pdfDoc.addPage([595.28, 841.89]);
        const lines = chunk.split('\n');
        let y = 800;
        for (const line of lines) {
          if (y < 50) break;
          page.drawText(line.substring(0, 80), { x: 50, y, size: 11 });
          y -= 16;
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      downloadBlob(blob, `${fileName || 'document'}.pdf`);
      toast.success('PDF exported!');
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    }
  };

  const ToolButton = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded-md transition-colors hover:bg-accent ${active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label className="mb-1 block text-sm">File Name</Label>
          <Input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="document" />
        </div>
        <div>
          <Label className="mb-1 block text-sm">Upload File</Label>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => document.getElementById('editor-file-upload')?.click()}
          >
            <FileUp className="h-4 w-4" /> Open File
          </Button>
          <input
            id="editor-file-upload"
            type="file"
            accept=".txt,.md,.doc,.docx,.html,.htm,.csv"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/50 rounded-lg border border-border">
        <Select value={fontFamily} onValueChange={v => { setFontFamily(v); exec('fontName', v); }}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map(f => (
              <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={fontSize} onValueChange={v => { setFontSize(v); exec('fontSize', '4'); }}>
          <SelectTrigger className="w-16 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map(s => (
              <SelectItem key={s} value={s}>{s}px</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-border mx-1" />

        <ToolButton onClick={() => exec('bold')} title="Bold"><Bold className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => exec('italic')} title="Italic"><Italic className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => exec('underline')} title="Underline"><Underline className="h-4 w-4" /></ToolButton>

        <div className="h-6 w-px bg-border mx-1" />

        <ToolButton onClick={() => exec('justifyLeft')} title="Align Left"><AlignLeft className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => exec('justifyCenter')} title="Align Center"><AlignCenter className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => exec('justifyRight')} title="Align Right"><AlignRight className="h-4 w-4" /></ToolButton>

        <div className="h-6 w-px bg-border mx-1" />

        <ToolButton onClick={() => exec('insertUnorderedList')} title="Bullet List"><List className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => exec('insertOrderedList')} title="Numbered List"><ListOrdered className="h-4 w-4" /></ToolButton>

        <div className="h-6 w-px bg-border mx-1" />

        <ToolButton onClick={() => exec('undo')} title="Undo"><Undo className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => exec('redo')} title="Redo"><Redo className="h-4 w-4" /></ToolButton>
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[400px] p-6 bg-white text-black rounded-lg border border-border shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/30 prose max-w-none"
        style={{ fontFamily, fontSize: `${fontSize}px` }}
      >
        <p>Start typing your document here or upload a file to edit...</p>
      </div>

      {/* Export buttons */}
      <div className="flex gap-3">
        <Button onClick={handleExportDocx} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export as Word (.docx)
        </Button>
        <Button onClick={handleExportPdf} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export as PDF
        </Button>
      </div>
    </div>
  );
};

export default WordEditor;
