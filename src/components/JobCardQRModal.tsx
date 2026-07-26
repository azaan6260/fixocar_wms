import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { JobCard, JobCardComment, UserRole } from '../types';
import { addJobCardComment } from '../lib/storage';
import { 
  X, 
  QrCode, 
  Copy, 
  Check, 
  Printer, 
  MessageSquare, 
  Send, 
  ExternalLink, 
  Sparkles, 
  Clock, 
  ShieldCheck, 
  Truck, 
  Car, 
  User, 
  Phone 
} from 'lucide-react';

interface JobCardQRModalProps {
  card: JobCard;
  currentRole?: UserRole;
  onClose: () => void;
  onOpenLiveTracker?: (jobCardId: string) => void;
}

export function JobCardQRModal({
  card,
  currentRole = 'FLOOR_MANAGER',
  onClose,
  onOpenLiveTracker
}: JobCardQRModalProps) {
  const [copied, setCopied] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [authorName, setAuthorName] = useState(() => {
    if (currentRole === 'FLOOR_MANAGER') return card.floorManagerName || 'Floor Manager';
    if (currentRole === 'MECHANIC') return 'Head Technician';
    if (currentRole === 'DELIVERY_BOY') return 'Delivery Partner';
    return card.customer.name || 'Valued Customer';
  });

  // Shareable URL for customer & staff
  const trackingUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/?jobCardId=${card.id}` 
    : `https://fixocar.in/track?jobCardId=${card.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    addJobCardComment(card.id, {
      jobCardId: card.id,
      authorName: authorName.trim() || 'Floor Staff',
      authorRole: currentRole,
      text: commentText.trim()
    });

    setCommentText('');
  };

  const commentsList = card.comments || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-amber-400 font-bold text-lg">{card.id}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                  QR Live Pass
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan to instantly view live repair progress & add floor notes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          
          {/* Main QR Card Badge */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/80 flex flex-col md:flex-row items-center gap-6">
            
            {/* QR Box */}
            <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center shrink-0">
              <QRCodeSVG
                value={trackingUrl}
                size={160}
                level="H"
                includeMargin={true}
                imageSettings={{
                  src: "/favicon.ico",
                  x: undefined,
                  y: undefined,
                  height: 24,
                  width: 24,
                  excavate: true,
                }}
              />
              <span className="font-mono text-[11px] text-slate-500 font-semibold mt-2 tracking-wider uppercase">
                Scan to Track
              </span>
            </div>

            {/* Vehicle & Customer Info */}
            <div className="flex-1 w-full space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <Car className="w-4 h-4 text-amber-500" />
                    {card.vehicle.make} {card.vehicle.model}
                  </h3>
                  <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {card.vehicle.registrationNumber}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Status</span>
                  <span className="font-bold text-xs uppercase px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 inline-block mt-0.5">
                    {card.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Customer</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> {card.customer.name}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Phone</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {card.customer.phone}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Workshop Bay</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {card.workshopName || 'Central Bay 4'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Floor Manager</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {card.floorManagerName || 'Rajesh Sharma'}
                  </p>
                </div>
              </div>

              {/* Action Buttons for Link */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Link Copied!' : 'Copy Live Link'}
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors"
                  title="Print Windshield Ticket"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Ticket
                </button>

                {onOpenLiveTracker && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenLiveTracker(card.id);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Tracker
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Comment Section */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                Scan & Live Floor Comments
              </h4>
              <span className="text-xs text-slate-500 font-medium">
                {commentsList.length} {commentsList.length === 1 ? 'update' : 'updates'}
              </span>
            </div>

            {/* Comment Form */}
            <form onSubmit={handlePostComment} className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add floor update (e.g., Brake pad replaced, test drive pending)..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                Post
              </button>
            </form>

            {/* Comments List */}
            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 mt-3">
              {commentsList.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  No floor comments added yet. Scan QR or type above to add a live update.
                </div>
              ) : (
                commentsList.map((comment) => (
                  <div 
                    key={comment.id}
                    className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {comment.authorName}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-semibold uppercase">
                          {comment.authorRole.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {comment.timestamp}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                      {comment.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Encoded URL: <code className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 truncate max-w-xs">{trackingUrl}</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
