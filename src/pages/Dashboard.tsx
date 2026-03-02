import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield, Stamp, LogOut, Upload, Download, Loader2, CheckCircle2,
  Save, Trash2, PenTool, Mail, Send, Share2, MessageSquare, Phone,
  Clock, Sparkles, FileCheck
} from 'lucide-react';
import { toast } from 'sonner';
import {
  convertWordToPdf,
  applyStampToPdf,
  downloadBlob,
} from '@/lib/documentProcessor';
import { saveStamp, getSavedStamps, deleteStamp, dataUrlToFile, type SavedStamp } from '@/lib/stampStorage';
import { saveSignature, getSavedSignatures, deleteSignature, dataUrlToFile as sigDataUrlToFile, type SavedSignature } from '@/lib/signatureStorage';
import { addHistoryEntry, getHistory, type HistoryEntry } from '@/lib/historyStorage';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Stamp state
  const [stampPdf, setStampPdf] = useState<File | null>(null);
  const [stampImage, setStampImage] = useState<File | null>(null);
  const [stampPages, setStampPages] = useState('all');
  const [stampPosition, setStampPosition] = useState('bottom-right');
  const [stampOpacity, setStampOpacity] = useState([0.7]);
  const [stampRotation, setStampRotation] = useState([0]);
  const [stampSize, setStampSize] = useState([100]);
  const [stamping, setStamping] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signPosition, setSignPosition] = useState('bottom-right');
  const [signOpacity, setSignOpacity] = useState([0.9]);
  const [signRotation, setSignRotation] = useState([0]);
  const [signSize, setSignSize] = useState([120]);
  const [signPages, setSignPages] = useState('all');

  // Share state
  const [lastStampedBlob, setLastStampedBlob] = useState<Blob | null>(null);
  const [lastStampedName, setLastStampedName] = useState('');

  // Saved stamps
  const [savedStamps, setSavedStamps] = useState<SavedStamp[]>([]);
  const [stampName, setStampName] = useState('');

  // Saved signatures
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([]);
  const [signatureName, setSignatureName] = useState('');

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    getSavedStamps().then(setSavedStamps).catch(console.error);
    getSavedSignatures().then(setSavedSignatures).catch(console.error);
    getHistory().then(setHistory).catch(console.error);
  }, []);

  const refreshHistory = async () => {
    const h = await getHistory();
    setHistory(h);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleStamp = async () => {
    if (!stampPdf || !stampImage) {
      toast.error('Please select both a document and a stamp');
      return;
    }
    setStamping(true);
    try {
      let pdfFile = stampPdf;
      const ext = stampPdf.name.toLowerCase();
      if (ext.endsWith('.doc') || ext.endsWith('.docx')) {
        toast.info('Converting Word document to PDF first...');
        const pdfBlob = await convertWordToPdf(stampPdf);
        pdfFile = new File([pdfBlob], stampPdf.name.replace(/\.(docx?|doc)$/i, '.pdf'), { type: 'application/pdf' });
      }

      const blob = await applyStampToPdf(pdfFile, stampImage, {
        pages: stampPages,
        position: stampPosition,
        opacity: stampOpacity[0],
        rotation: stampRotation[0],
        size: stampSize[0],
        signatureFile: signatureFile || undefined,
        signaturePosition: signPosition,
        signatureOpacity: signOpacity[0],
        signatureRotation: signRotation[0],
        signatureSize: signSize[0],
        signaturePages: signPages,
      });
      const filename = 'stamped_' + pdfFile.name;
      downloadBlob(blob, filename);
      setLastStampedBlob(blob);
      setLastStampedName(filename);
      toast.success('Stamp applied securely! File downloaded.');

      await addHistoryEntry({
        inputName: stampPdf.name,
        outputName: filename,
        date: new Date().toISOString(),
        stampName: stampImage.name,
        signatureName: signatureFile?.name,
      });
      await refreshHistory();
    } catch (err) {
      console.error(err);
      toast.error('Stamping failed. Please check your files.');
    }
    setStamping(false);
  };

  const handleSaveStamp = async () => {
    if (!stampImage) { toast.error('Upload a stamp image first'); return; }
    const name = stampName.trim() || stampImage.name;
    try {
      const saved = await saveStamp(stampImage, name);
      setSavedStamps(prev => [...prev, saved]);
      setStampName('');
      toast.success(`Stamp "${name}" saved!`);
    } catch { toast.error('Failed to save stamp'); }
  };

  const handleDeleteStamp = async (id: string) => {
    await deleteStamp(id);
    setSavedStamps(prev => prev.filter(s => s.id !== id));
    toast.success('Stamp deleted');
  };

  const handleUseSavedStamp = (stamp: SavedStamp) => {
    const file = dataUrlToFile(stamp.dataUrl, stamp.name, stamp.mimeType);
    setStampImage(file);
    toast.success(`Using stamp: ${stamp.name}`);
  };

  const handleSaveSignature = async () => {
    if (!signatureFile) { toast.error('Upload a signature first'); return; }
    const name = signatureName.trim() || signatureFile.name;
    try {
      const saved = await saveSignature(signatureFile, name);
      setSavedSignatures(prev => [...prev, saved]);
      setSignatureName('');
      toast.success(`Signature "${name}" saved!`);
    } catch { toast.error('Failed to save signature'); }
  };

  const handleDeleteSignature = async (id: string) => {
    await deleteSignature(id);
    setSavedSignatures(prev => prev.filter(s => s.id !== id));
    toast.success('Signature deleted');
  };

  const handleUseSavedSignature = (sig: SavedSignature) => {
    const file = sigDataUrlToFile(sig.dataUrl, sig.name, sig.mimeType);
    setSignatureFile(file);
    toast.success(`Using signature: ${sig.name}`);
  };


  const shareFile = (method: string) => {
    if (!lastStampedBlob) return;
    const name = encodeURIComponent(lastStampedName);
    const msg = encodeURIComponent(`Here is the stamped document: ${lastStampedName}`);

    switch (method) {
      case 'email': {
        const subject = encodeURIComponent(`Stamped Document: ${lastStampedName}`);
        const body = encodeURIComponent(`Please find the stamped document attached.\n\nNote: The file "${lastStampedName}" has been downloaded. Please attach it manually.`);
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
        toast.info('Email client opened. Attach the downloaded file.');
        break;
      }
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(' ')}&text=${msg}`, '_blank');
        toast.info('Telegram opened.');
        break;
      case 'whatsapp':
        window.open(`https://wa.me/?text=${msg}`, '_blank');
        toast.info('WhatsApp opened.');
        break;
      case 'sms':
        window.open(`sms:?body=${msg}`, '_blank');
        toast.info('SMS opened.');
        break;
      case 'system':
        if (navigator.share) {
          const file = new File([lastStampedBlob], lastStampedName, { type: 'application/pdf' });
          navigator.share({ files: [file], title: lastStampedName }).catch(() => {
            toast.error('Sharing cancelled');
          });
        } else {
          toast.error('Web Share not supported in this browser');
        }
        break;
    }
  };

  const onDrop = useCallback((setter: (f: File) => void) => (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setter(file);
  }, []);

  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const cardClass = "bg-card rounded-2xl border border-border p-6 shadow-elegant backdrop-blur-sm";
  const uploadZoneClass = "border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-all duration-300 group";

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
              <Shield className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="text-lg font-display font-bold tracking-tight">Rabuma</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-sm text-muted-foreground">Hi, {user?.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl gradient-accent flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground text-sm">Apply secure stamps & signatures — all in your browser.</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="stamp" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 max-w-md bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="stamp" className="gap-1.5 rounded-lg data-[state=active]:shadow-md transition-all">
                <Stamp className="h-4 w-4" /> Stamp & Sign
              </TabsTrigger>
              <TabsTrigger value="share" className="gap-1.5 rounded-lg data-[state=active]:shadow-md transition-all">
                <Share2 className="h-4 w-4" /> Share
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 rounded-lg data-[state=active]:shadow-md transition-all">
                <Clock className="h-4 w-4" /> History
              </TabsTrigger>
            </TabsList>

            {/* STAMP & SIGN TAB */}
            <TabsContent value="stamp">
              <div className="space-y-6">
                {/* Upload Section */}
                <div className={cardClass}>
                  <div className="flex items-center gap-2 mb-5">
                    <Upload className="h-5 w-5 text-accent" />
                    <h2 className="text-lg font-display font-semibold">Upload Files</h2>
                  </div>
                  <div className="grid md:grid-cols-2 gap-5">
                    {/* PDF Upload */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block text-muted-foreground">Document (PDF/DOC/DOCX)</Label>
                      <div
                        className={uploadZoneClass}
                        onDrop={onDrop(setStampPdf)}
                        onDragOver={onDragOver}
                        onClick={() => document.getElementById('stamp-pdf-input')?.click()}
                      >
                        <input id="stamp-pdf-input" type="file" accept=".pdf,.doc,.docx" className="hidden"
                          onChange={e => e.target.files?.[0] && setStampPdf(e.target.files[0])} />
                        {stampPdf ? (
                          <div className="flex items-center justify-center gap-2 text-success">
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="font-medium text-sm">{stampPdf.name}</span>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2 group-hover:text-accent transition-colors" />
                            <p className="text-muted-foreground text-sm">Drag & drop or click</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">PDF, DOC, DOCX</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stamp Upload */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block text-muted-foreground">Stamp (Image or PDF)</Label>
                      <div
                        className={uploadZoneClass}
                        onDrop={onDrop(setStampImage)}
                        onDragOver={onDragOver}
                        onClick={() => document.getElementById('stamp-img-input')?.click()}
                      >
                        <input id="stamp-img-input" type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden"
                          onChange={e => e.target.files?.[0] && setStampImage(e.target.files[0])} />
                        {stampImage ? (
                          <div className="flex items-center justify-center gap-2 text-success">
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="font-medium text-sm">{stampImage.name}</span>
                          </div>
                        ) : (
                          <>
                            <Stamp className="h-8 w-8 text-muted-foreground mx-auto mb-2 group-hover:text-accent transition-colors" />
                            <p className="text-muted-foreground text-sm">Drag & drop or click</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG, PDF</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Save stamp */}
                  <AnimatePresence>
                    {stampImage && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="mt-4 flex items-end gap-3 p-4 bg-muted/30 rounded-xl border border-border">
                        <div className="flex-1">
                          <Label className="mb-1 block text-xs text-muted-foreground">Save this stamp for later</Label>
                          <Input value={stampName} onChange={e => setStampName(e.target.value)} placeholder="Stamp name (optional)" className="h-9" />
                        </div>
                        <Button onClick={handleSaveStamp} variant="outline" size="sm" className="gap-1 h-9">
                          <Save className="h-3.5 w-3.5" /> Save
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Saved stamps library */}
                  {savedStamps.length > 0 && (
                    <div className="mt-4">
                      <Label className="text-xs font-semibold mb-2 block text-muted-foreground uppercase tracking-wider">Saved Stamps</Label>
                      <div className="flex flex-wrap gap-2">
                        {savedStamps.map(s => (
                          <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-all">
                            <img src={s.dataUrl} alt={s.name} className="h-9 w-9 object-contain rounded-lg" />
                            <span className="text-xs font-medium max-w-[80px] truncate">{s.name}</span>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleUseSavedStamp(s)}>Use</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-1.5 text-destructive" onClick={() => handleDeleteStamp(s.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Stamp Settings */}
                <div className={cardClass}>
                  <div className="flex items-center gap-2 mb-5">
                    <Stamp className="h-5 w-5 text-accent" />
                    <h2 className="text-lg font-display font-semibold">Stamp Settings</h2>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2 block text-sm">Pages to Stamp</Label>
                        <Input value={stampPages} onChange={e => setStampPages(e.target.value)} placeholder='all, or 1,3,5 or 2-5' className="h-9" />
                        <p className="text-xs text-muted-foreground mt-1">Use "all" or ranges like 1,3,5-9</p>
                      </div>
                      <div>
                        <Label className="mb-2 block text-sm">Position</Label>
                        <Select value={stampPosition} onValueChange={setStampPosition}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top-left">Top Left</SelectItem>
                            <SelectItem value="top-right">Top Right</SelectItem>
                            <SelectItem value="bottom-left">Bottom Left</SelectItem>
                            <SelectItem value="bottom-right">Bottom Right</SelectItem>
                            <SelectItem value="bottom-center">Bottom Center</SelectItem>
                            <SelectItem value="center">Center</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2 block text-sm">Opacity: {Math.round(stampOpacity[0] * 100)}%</Label>
                        <Slider value={stampOpacity} onValueChange={setStampOpacity} min={0.1} max={1} step={0.05} />
                      </div>
                      <div>
                        <Label className="mb-2 block text-sm">Rotation: {stampRotation[0]}°</Label>
                        <Slider value={stampRotation} onValueChange={setStampRotation} min={-180} max={180} step={5} />
                      </div>
                      <div>
                        <Label className="mb-2 block text-sm">Size: {stampSize[0]}px</Label>
                        <Slider value={stampSize} onValueChange={setStampSize} min={30} max={300} step={10} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Signature Section */}
                <div className={cardClass}>
                  <div className="flex items-center gap-2 mb-5">
                    <PenTool className="h-5 w-5 text-accent" />
                    <h2 className="text-lg font-display font-semibold">Signature (Optional)</h2>
                  </div>

                  <div
                    className={uploadZoneClass}
                    onClick={() => document.getElementById('signature-input')?.click()}
                  >
                    <input id="signature-input" type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setSignatureFile(f); }} />
                    {signatureFile ? (
                      <div className="flex items-center justify-center gap-2 text-success">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium text-sm">{signatureFile.name}</span>
                        <Button variant="ghost" size="sm" className="text-destructive h-7 ml-2" onClick={(e) => { e.stopPropagation(); setSignatureFile(null); }}>Remove</Button>
                      </div>
                    ) : (
                      <>
                        <PenTool className="h-8 w-8 text-muted-foreground mx-auto mb-2 group-hover:text-accent transition-colors" />
                        <p className="text-muted-foreground text-sm">Upload signature (PNG, JPG, PDF)</p>
                      </>
                    )}
                  </div>

                  {/* Save signature */}
                  <AnimatePresence>
                    {signatureFile && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="mt-4 flex items-end gap-3 p-4 bg-muted/30 rounded-xl border border-border">
                        <div className="flex-1">
                          <Label className="mb-1 block text-xs text-muted-foreground">Save this signature for later</Label>
                          <Input value={signatureName} onChange={e => setSignatureName(e.target.value)} placeholder="Signature name (optional)" className="h-9" />
                        </div>
                        <Button onClick={handleSaveSignature} variant="outline" size="sm" className="gap-1 h-9">
                          <Save className="h-3.5 w-3.5" /> Save
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Saved signatures library */}
                  {savedSignatures.length > 0 && (
                    <div className="mt-4">
                      <Label className="text-xs font-semibold mb-2 block text-muted-foreground uppercase tracking-wider">Saved Signatures</Label>
                      <div className="flex flex-wrap gap-2">
                        {savedSignatures.map(s => (
                          <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-all">
                            <img src={s.dataUrl} alt={s.name} className="h-9 w-9 object-contain rounded-lg" />
                            <span className="text-xs font-medium max-w-[80px] truncate">{s.name}</span>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleUseSavedSignature(s)}>Use</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-1.5 text-destructive" onClick={() => handleDeleteSignature(s.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Signature Settings */}
                  <AnimatePresence>
                    {signatureFile && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="mt-5 grid md:grid-cols-2 gap-6 pt-5 border-t border-border">
                        <div className="space-y-4">
                          <div>
                            <Label className="mb-2 block text-sm">Pages to Sign</Label>
                            <Input value={signPages} onChange={e => setSignPages(e.target.value)} placeholder='all, or 1,3,5 or 2-5' className="h-9" />
                            <p className="text-xs text-muted-foreground mt-1">Use "all" or ranges like 1,3,5-9</p>
                          </div>
                          <div>
                            <Label className="mb-2 block text-sm">Signature Position</Label>
                            <Select value={signPosition} onValueChange={setSignPosition}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="top-left">Top Left</SelectItem>
                                <SelectItem value="top-right">Top Right</SelectItem>
                                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                                <SelectItem value="bottom-right">Bottom Right</SelectItem>
                                <SelectItem value="bottom-center">Bottom Center</SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <Label className="mb-2 block text-sm">Opacity: {Math.round(signOpacity[0] * 100)}%</Label>
                            <Slider value={signOpacity} onValueChange={setSignOpacity} min={0.1} max={1} step={0.05} />
                          </div>
                          <div>
                            <Label className="mb-2 block text-sm">Rotation: {signRotation[0]}°</Label>
                            <Slider value={signRotation} onValueChange={setSignRotation} min={-180} max={180} step={5} />
                          </div>
                          <div>
                            <Label className="mb-2 block text-sm">Size: {signSize[0]}px</Label>
                            <Slider value={signSize} onValueChange={setSignSize} min={30} max={300} step={10} />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Security note & Apply */}
                <div className={cardClass}>
                  <div className="p-3 bg-muted/30 rounded-xl border border-border mb-5">
                    <p className="text-xs text-muted-foreground">
                      🔒 <strong>Security:</strong> Stamps & signatures are deeply merged into the PDF. Metadata is stripped and the file is flattened so overlays cannot be extracted.
                    </p>
                  </div>
                  <Button
                    onClick={handleStamp}
                    disabled={!stampPdf || !stampImage || stamping}
                    className="w-full gradient-primary text-primary-foreground h-12 text-base font-display font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
                  >
                    {stamping ? (
                      <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Applying secure stamp...</>
                    ) : (
                      <><Stamp className="h-5 w-5 mr-2" /> Apply Secure Stamp & Download</>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* SHARE TAB */}
            <TabsContent value="share">
              <div className={cardClass}>
                <div className="flex items-center gap-2 mb-5">
                  <Share2 className="h-5 w-5 text-accent" />
                  <h2 className="text-lg font-display font-semibold">Share Stamped File</h2>
                </div>

                {lastStampedBlob ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 p-4 bg-success/10 rounded-xl border border-success/20">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div>
                        <p className="text-sm font-medium">{lastStampedName}</p>
                        <p className="text-xs text-muted-foreground">Ready to share</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Button variant="outline" className="gap-2 h-14 flex-col rounded-xl hover:bg-accent/10 hover:border-accent transition-all" onClick={() => shareFile('email')}>
                        <Mail className="h-5 w-5 text-accent" />
                        <span className="text-xs">Email</span>
                      </Button>
                      <Button variant="outline" className="gap-2 h-14 flex-col rounded-xl hover:bg-accent/10 hover:border-accent transition-all" onClick={() => shareFile('telegram')}>
                        <Send className="h-5 w-5 text-accent" />
                        <span className="text-xs">Telegram</span>
                      </Button>
                      <Button variant="outline" className="gap-2 h-14 flex-col rounded-xl hover:bg-accent/10 hover:border-accent transition-all" onClick={() => shareFile('whatsapp')}>
                        <MessageSquare className="h-5 w-5 text-accent" />
                        <span className="text-xs">WhatsApp</span>
                      </Button>
                      <Button variant="outline" className="gap-2 h-14 flex-col rounded-xl hover:bg-accent/10 hover:border-accent transition-all" onClick={() => shareFile('sms')}>
                        <Phone className="h-5 w-5 text-accent" />
                        <span className="text-xs">SMS</span>
                      </Button>
                      <Button variant="outline" className="gap-2 h-14 flex-col rounded-xl hover:bg-accent/10 hover:border-accent transition-all col-span-2 sm:col-span-1" onClick={() => shareFile('system')}>
                        <Share2 className="h-5 w-5 text-accent" />
                        <span className="text-xs">More...</span>
                      </Button>
                    </div>

                    <Button variant="outline" className="w-full gap-2" onClick={() => { downloadBlob(lastStampedBlob!, lastStampedName); }}>
                      <Download className="h-4 w-4" /> Download Again
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Share2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No stamped file yet.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Apply a stamp first, then share from here.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* HISTORY TAB */}
            <TabsContent value="history">
              <div className={cardClass}>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-accent" />
                    <h2 className="text-lg font-display font-semibold">Stamp History</h2>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-4 p-2 bg-muted/30 rounded-lg">
                  📌 History is stored locally in this browser only and auto-deletes after 2 days.
                </p>

                {history.length === 0 ? (
                  <div className="text-center py-10">
                    <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No stamp history yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <Stamp className="h-4 w-4 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.inputName}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{new Date(item.date).toLocaleString()}</span>
                              {item.stampName && <span>• stamp: {item.stampName}</span>}
                              {item.signatureName && <span>• sig: {item.signatureName}</span>}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Privacy footer */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/30 border border-border">
              <Shield className="h-3.5 w-3.5 text-accent" />
              <p className="text-xs text-muted-foreground">
                All processing happens locally in your browser. Your documents are never uploaded.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
