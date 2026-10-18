import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Camera,
  FileUp,
  Send,
  Copy,
  Check,
  Sparkles,
  Car,
  Wrench,
  Paintbrush,
  ShoppingBag,
  Video,
  Brain,
  Plus,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Layers,
  Users,
  ShieldCheck,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { UserRole } from '../types';
import {
  getAuthUser,
  getCarModels,
  getStandardJobs,
  subscribeToStore,
  dispatchToastNotification,
} from '../lib/storage';
import {
  AIChatMessage,
  AIParsedJobCardPayload,
  AIVehiclePhotoAnalysis,
  WorkshopLearnedRule,
  getLearnedWorkshopRules,
  saveLearnedWorkshopRule,
  deleteLearnedWorkshopRule,
  getSavedAIChatHistory,
  saveAIChatHistory,
  generateCopyablePaintJobsSummary,
  generateConsolidatedPartsPurchaseList,
  syncPurchaseReportToPartOrderBasket,
  createGateCheckInFromAiPhoto,
  createActionableJobCardFromAiPayload,
  buildLiveWorkshopSnapshotForAI,
  selectOptimalWorkshopTechnicians,
  resolveAgentSessionAccess,
  getScopedJobCardsForAgent,
  detectForbiddenEmployeeMutationIntent,
} from '../lib/aiWorkshopAgentService';

interface AIWorkshopAgentViewProps {
  currentRole: UserRole;
  onSelectJobCard?: (cardId: string) => void;
  onOpenJobCard?: (cardId: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export function AIWorkshopAgentView({
  currentRole,
  onSelectJobCard,
  onOpenJobCard,
  onNavigateTab,
}: AIWorkshopAgentViewProps) {
  const handleOpenCard = (cardId: string) => {
    if (onSelectJobCard) onSelectJobCard(cardId);
    else if (onOpenJobCard) onOpenJobCard(cardId);
  };

  const authUser = getAuthUser();
  const access = resolveAgentSessionAccess(currentRole);
  const { cards: scopedCards } = getScopedJobCardsForAgent(currentRole);

  const [activeSubView, setActiveSubView] = useState<'CHAT' | 'PAINT_SHEET' | 'PURCHASE_SHEET' | 'RULES_AND_GUIDE'>('CHAT');

  const buildWelcomeMessageForRole = (): AIChatMessage => {
    const currentAccess = resolveAgentSessionAccess(currentRole);
    const { cards } = getScopedJobCardsForAgent(currentRole);
    if (currentAccess.isManagementRole) {
      return {
        id: `welcome-msg-${currentAccess.role}`,
        sender: 'AI',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `Hello **${currentAccess.userName}** (**${currentAccess.role}**)! You are logged in with **Full Workshop Management Access** (${cards.length} active vehicles).\n\nYou can manage daily workshop operations right from this chat:\n• 📸 **Snap/Upload a Car Photo** to detect Registration Number, Make/Model, and log Gate Entry.\n• 📄 **Upload a Cars24 PDF / Work Order** to extract jobs, create our internal Job Card, auto-allot Painter, Denter & Mechanic, and request employee inspection videos.\n• 🎨 **Get Copy-Paste Paint Jobs List** across all active vehicles in one click.\n• 🛒 **Get Vehicle-by-Vehicle & Today's Total Parts Purchase List** ready to share with suppliers.\n• 🧠 **Teach Me Daily Rules** in plain text (e.g., *"Teach: When a Creta comes for Front Bumper paint, always check Headlight Brackets and order 10x Bumper Clips"*).`,
        followUpPrompts: [
          'Give me the list of paint jobs to copy and paste',
          "Give me today's total parts purchase list by vehicle",
          'Simulate Cars24 PDF Job Card upload & auto-allotment',
          'Teach: For Swift front bumper replacement, check radiator support & order 8x bumper clips',
        ],
      };
    }

    return {
      id: `welcome-msg-${currentAccess.role}-${currentAccess.employeeId}`,
      sender: 'AI',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `Hello **${currentAccess.userName}** (**${currentAccess.role}**)! I am connected to your personal employee account.\n\n🔒 **Role-Based Database Scope Active**:\n• I only fetch the **${cards.length} vehicle(s) and tasks allotted specifically to your account (${currentAccess.userName})**.\n• Customer billing rates, other staff payouts, creating Job Cards, and editing/deleting tasks are **locked** for ${currentAccess.role} accounts.\n\n✅ **How I Can Help You Today**:\n• 🚗 **My Allotted Cars & Tasks**: Ask which vehicles and panels/tasks are assigned to you right now.\n• 📹 **My Video Inspection Checklist**: Check which allotted vehicles need a 15-sec proof video for additional work.\n• 🛒 **My Bay Parts & Consumables**: View the exact spare parts or paint kits required for your allotted vehicles.`,
      followUpPrompts: [
        'Show my allotted vehicles and tasks',
        'What inspection videos do I need to record for my allotted cars?',
        'Give me the list of paint jobs allotted to me',
        'Show parts required for my allotted vehicles',
      ],
    };
  };

  const [messages, setMessages] = useState<AIChatMessage[]>(() => {
    const saved = getSavedAIChatHistory();
    if (saved.length > 0) return saved;
    return [buildWelcomeMessageForRole()];
  });

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [learnedRules, setLearnedRules] = useState<WorkshopLearnedRule[]>(() => getLearnedWorkshopRules());

  // New Rule Form State
  const [newRuleTrigger, setNewRuleTrigger] = useState('');
  const [newRuleInstruction, setNewRuleInstruction] = useState('');
  const [newRuleParts, setNewRuleParts] = useState('');
  const [newRuleVideoPrompt, setNewRuleVideoPrompt] = useState('');

  // Live reports state (Automatically scoped to currentRole & logged-in employee)
  const [livePaintReport, setLivePaintReport] = useState(() =>
    generateCopyablePaintJobsSummary(undefined, currentRole)
  );
  const [livePurchaseReport, setLivePurchaseReport] = useState(() =>
    generateConsolidatedPartsPurchaseList(undefined, currentRole)
  );

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refreshLiveReports = () => {
      setLivePaintReport(generateCopyablePaintJobsSummary(vehicleFilter, currentRole));
      setLivePurchaseReport(generateConsolidatedPartsPurchaseList(vehicleFilter, currentRole));
      setLearnedRules(getLearnedWorkshopRules());
    };
    refreshLiveReports();
    const unsub = subscribeToStore(refreshLiveReports);
    return () => unsub();
  }, [vehicleFilter, currentRole]);

  // Update welcome banner when user switches role in header so they immediately see the role-scoped AI context
  useEffect(() => {
    setMessages((prev) => {
      const nextWelcome = buildWelcomeMessageForRole();
      if (prev.length <= 1) return [nextWelcome];
      return [
        ...prev,
        {
          id: `role-switch-${Date.now()}`,
          sender: 'AI',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: nextWelcome.text,
          followUpPrompts: nextWelcome.followUpPrompts,
        },
      ];
    });
  }, [currentRole]);

  useEffect(() => {
    saveAIChatHistory(messages);
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  const handleCopyText = async (text: string, idKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(idKey);
      dispatchToastNotification({
        type: 'SUCCESS',
        title: '📋 Copied to Clipboard',
        message: 'Formatted list is ready to paste into WhatsApp, Notes, or Vendor chat.',
      });
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Fallback textarea copy
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(idKey);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

  // 1. Handle Incoming Camera / Vehicle Photo
  const handleVehiclePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsProcessing(true);
    try {
      const base64 = await fileToBase64(file);
      const userMsg: AIChatMessage = {
        id: `msg-user-${Date.now()}`,
        sender: 'USER',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `📸 Uploaded vehicle arrival photo (${file.name}) for License Plate & Model identification.`,
        attachmentPreviewUrl: base64,
        attachmentName: file.name,
        attachmentType: 'IMAGE',
      };
      setMessages((prev) => [...prev, userMsg]);
      scrollToBottom();

      const response = await fetch('/api/ai-agent/analyze-vehicle-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          carModels: getCarModels(),
          learnedRules: getLearnedWorkshopRules(),
        }),
      });
      const data = await response.json();

      if (data.success && data.analysis) {
        const analysis: AIVehiclePhotoAnalysis = data.analysis;
        const techs = selectOptimalWorkshopTechnicians();
        const aiMsg: AIChatMessage = {
          id: `msg-ai-${Date.now()}`,
          sender: 'AI',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `✅ **Vehicle Identified from Photo**:\n• **Reg No**: \`${analysis.plateNumber || 'DETECTED'}\`\n• **Make & Model**: **${analysis.make} ${analysis.model}** ${analysis.variant ? `(${analysis.variant})` : ''} — ${analysis.color || 'Standard'}, ${analysis.fuelType || 'Petrol'}\n• **Recommended Allotment**: Painter **${techs.painter?.name || 'Available Painter'}**, Denter **${techs.denter?.name || 'Available Denter'}**, Mechanic **${techs.mechanic?.name || 'Available Mechanic'}**\n\nClick below to log Gate Check-In or create the Job Card with pre-allotted tasks:`,
          vehicleAnalysis: analysis,
          followUpPrompts: [
            'Give me the list of paint jobs to copy and paste',
            'Give me today\'s total parts purchase list by vehicle',
          ],
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error(data.error || 'Could not analyze vehicle image');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'AI',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `⚠️ Vehicle image scan encountered an issue: ${err.message}. You can also use the quick sample vehicle scan or type the registration number directly.`,
        },
      ]);
    } finally {
      setIsProcessing(false);
      scrollToBottom();
    }
  };

  // 2. Handle Uploaded PDF Job Card (e.g. Cars24 Work Order PDF) or Simulated Sample PDF
  const processJobCardPdfOrSample = async (fileBase64?: string, fileName = 'Cars24_Refurb_WorkOrder.pdf', extractedText?: string) => {
    if (!access.canCreateJobCard) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-rbac-${Date.now()}`,
          sender: 'AI',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `🔒 **Access Restricted (${access.userName} • ${access.role})**:\nUploading Cars24 PDFs to create Job Cards and allot staff is restricted to **Admin**, **Floor Manager**, and **Service Advisor** accounts.`,
        },
      ]);
      scrollToBottom();
      return;
    }

    setIsProcessing(true);
    try {
      const userMsg: AIChatMessage = {
        id: `msg-user-${Date.now()}`,
        sender: 'USER',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `📄 Shared Job Card Document: **${fileName}** — Parse underlying jobs, allot Painter/Denter/Mechanic, list required parts, and generate employee video check prompts.`,
        attachmentName: fileName,
        attachmentType: 'PDF',
      };
      setMessages((prev) => [...prev, userMsg]);
      scrollToBottom();

      const response = await fetch('/api/ai-agent/parse-job-card-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64,
          fileName,
          extractedText,
          userRole: currentRole,
          standardJobs: getStandardJobs(),
          learnedRules: getLearnedWorkshopRules(),
        }),
      });
      const data = await response.json();

      if (data.success && data.parsedJobCard) {
        const parsed: AIParsedJobCardPayload = data.parsedJobCard;
        const techs = selectOptimalWorkshopTechnicians();
        const paintCount = (parsed.tasks || []).filter((t) => t.category === 'PAINT' || t.category === 'DENTING').length;
        const mechCount = (parsed.tasks || []).length - paintCount;

        const aiMsg: AIChatMessage = {
          id: `msg-ai-${Date.now()}`,
          sender: 'AI',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `📋 **Parsed Job Card Document (${fileName})**:\n• **Vehicle**: \`${parsed.registrationNumber}\` — **${parsed.make} ${parsed.model}** ${parsed.variant || ''} (${parsed.color || 'Standard'}, ${parsed.fuelType || 'Petrol'})\n• **Work Order**: ${parsed.isCars24 ? `Cars24 Ref \`${parsed.cars24RefNo || 'C24-FLEET'}\`` : 'Customer Work Order'} — ${parsed.tasks?.length || 0} Tasks (${paintCount} Paint/Dent Panels, ${mechCount} Mechanical/Service)\n• **Ready to Allot**: Painter **${techs.painter?.name}**, Denter **${techs.denter?.name}**, Mechanic **${techs.mechanic?.name}**\n• **Parts Extracted**: ${parsed.requiredParts?.length || 0} items ready for today's purchase list.\n\nReview the extracted tasks below and click **"Create Internal Job Card & Allot Team"** to save it to the workshop database:`,
          parsedPdfJobCard: parsed,
          followUpPrompts: [
            'Give me the list of paint jobs to copy and paste',
            "Give me today's total parts purchase list by vehicle",
          ],
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error(data.error || 'Could not parse Job Card PDF');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'AI',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `⚠️ Failed to parse PDF document: ${err.message}`,
        },
      ]);
    } finally {
      setIsProcessing(false);
      scrollToBottom();
    }
  };

  const handlePdfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const base64 = await fileToBase64(file);
    await processJobCardPdfOrSample(base64, file.name);
  };

  // 3. Handle Natural Language Chat & Instant Command Detection with Strict RBAC Guardrails
  const handleSendChat = async (customPrompt?: string) => {
    const raw = (customPrompt !== undefined ? customPrompt : inputText).trim();
    if (!raw || isProcessing) return;
    if (customPrompt === undefined) setInputText('');

    const low = raw.toLowerCase();

    // Check if user clicked "Simulate Cars24 PDF Job Card upload"
    if (low.includes('simulate cars24 pdf')) {
      await processJobCardPdfOrSample(
        undefined,
        'Cars24_Baleno_KA01MJ4455_WorkOrder.pdf',
        `CARS24 REFURBISHMENT WORK ORDER #C24-884920
Vehicle Reg No: KA01MJ4455 | Make: Maruti Suzuki | Model: Baleno Zeta 1.2 Petrol | Year: 2022 | Color: Nexa Blue | Odometer: 44,800 km
1. Front Bumper - Full Outer Dent & Paint (Scratches & RHS corner dent)
2. Hood / Bonnet - Full Outer Paint (Stone chips & minor dings)
3. Door RHS Front - Full Outer Dent & Paint
4. Periodic Engine Service - 0W-20 Synthetic Oil & Oil/Air Filter Replacement
5. Front Disc Brake Pads Replacement & Caliper Greasing
Additional Instruction: Ask technician to upload 15-sec video of Front Lower Arm Bushes, Radiator Support & Brake Rotor thickness.`
      );
      return;
    }

    const userMsg: AIChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'USER',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: raw,
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    // STRICT RBAC GUARDRAIL: Block non-management employees from editing/deleting tasks, changing prices, or creating Job Cards
    const forbiddenReason = detectForbiddenEmployeeMutationIntent(raw, access);
    if (forbiddenReason) {
      const rbacMsg: AIChatMessage = {
        id: `msg-rbac-${Date.now()}`,
        sender: 'AI',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: forbiddenReason,
        followUpPrompts: [
          'Show my allotted vehicles and tasks',
          'What inspection videos do I need to record for my allotted cars?',
          'Show parts required for my allotted vehicles',
        ],
      };
      setMessages((prev) => [...prev, rbacMsg]);
      scrollToBottom();
      return;
    }

    // Fast path for Employee asking "Show my allotted vehicles and tasks" or "What inspection videos..."
    if (
      !access.isManagementRole &&
      (low.includes('my allotted') || low.includes('my vehicle') || low.includes('my task') || low.includes('video'))
    ) {
      const { cards: myCards } = getScopedJobCardsForAgent(currentRole);
      const summaryLines =
        myCards.length === 0
          ? `You currently have **0 active vehicles** allotted to **${access.userName}** (**${access.role}**).`
          : myCards
              .map((c, idx) => {
                const taskLines = c.tasks
                  .map((t) => `   • [${t.status}] **${t.title}** (${t.category})${t.notes ? `\n     📹 *${t.notes}*` : ''}`)
                  .join('\n');
                return `${idx + 1}. **${c.vehicle.registrationNumber}** — ${c.vehicle.make} ${c.vehicle.model} (${c.vehicle.color})\n${taskLines}`;
              })
              .join('\n\n');

      const empMsg: AIChatMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: 'AI',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `👷 **Account-Scoped Queue for ${access.userName} (${access.role})**:\nShowing only vehicles and tasks allotted to your account in the database (**${myCards.length} vehicle(s)**):\n\n${summaryLines}`,
        followUpPrompts: [
          'Give me the list of paint jobs allotted to me',
          'Show parts required for my allotted vehicles',
        ],
      };
      setMessages((prev) => [...prev, empMsg]);
      scrollToBottom();
      return;
    }

    // Fast path for Paint Jobs copy-paste list (Automatically scoped to role!)
    if (
      (low.includes('paint') && (low.includes('list') || low.includes('copy') || low.includes('job') || low.includes('panel') || low.includes('allotted'))) ||
      low === 'paint jobs'
    ) {
      const report = generateCopyablePaintJobsSummary(undefined, currentRole);
      setLivePaintReport(report);
      const aiMsg: AIChatMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: 'AI',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: access.canViewFullWorkshopData
          ? `🎨 Here is the **Full Workshop Active Paint & Denting Jobs List** across **${report.totalVehicles} vehicle(s)** (**${report.totalPanels} total panels**). You can copy and paste this entire formatted sheet in one click:`
          : `🎨 Here is your **Account-Scoped Paint & Denting Panel List** allotted to **${access.userName} (${access.role})** across **${report.totalVehicles} vehicle(s)** (**${report.totalPanels} panels**, customer billing rates hidden):`,
        paintReport: report,
        followUpPrompts: access.isManagementRole
          ? [
              "Give me today's total parts purchase list by vehicle",
              'Simulate Cars24 PDF Job Card upload & auto-allotment',
            ]
          : [
              'Show my allotted vehicles and tasks',
              'Show parts required for my allotted vehicles',
            ],
      };
      setMessages((prev) => [...prev, aiMsg]);
      scrollToBottom();
      return;
    }

    // Fast path for Parts Required / Vehicle-by-Vehicle + Consolidated Daily Purchase List (Automatically scoped to role!)
    if (
      low.includes('purchase') ||
      (low.includes('part') && (low.includes('list') || low.includes('require') || low.includes('buy') || low.includes('order') || low.includes('today') || low.includes('allotted')))
    ) {
      const report = generateConsolidatedPartsPurchaseList(undefined, currentRole);
      setLivePurchaseReport(report);
      const aiMsg: AIChatMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: 'AI',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: access.canViewFullWorkshopData
          ? `🛒 Here is the **Vehicle-by-Vehicle Required Parts List** followed by **Today's Consolidated Master Purchase List** across **${report.vehicleGroups.length} active vehicle(s)** (**${report.totalUniquePartsToBuy} unique items**, Est. Total: **₹${report.grandTotalEstimatedCost.toLocaleString('en-IN')}**):`
          : `🛒 Here are the **Required Spare Parts & Consumables** scoped strictly to the **${report.vehicleGroups.length} vehicle(s) allotted to ${access.userName} (${access.role})**:`,
        purchaseReport: report,
        followUpPrompts: access.isManagementRole
          ? [
              'Give me the list of paint jobs to copy and paste',
              'Simulate Cars24 PDF Job Card upload & auto-allotment',
            ]
          : [
              'Show my allotted vehicles and tasks',
              'Give me the list of paint jobs allotted to me',
            ],
      };
      setMessages((prev) => [...prev, aiMsg]);
      scrollToBottom();
      return;
    }

    // Conversational AI / Rule Learning via Server Gemini API (with Role-Scoped Snapshot)
    setIsProcessing(true);
    try {
      const snapshot = buildLiveWorkshopSnapshotForAI(currentRole);
      const response = await fetch('/api/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: raw,
          userRole: currentRole,
          userName: access.userName,
          employeeId: access.employeeId,
          accessPolicy: access,
          workshopSnapshot: snapshot,
          learnedRules: getLearnedWorkshopRules(),
        }),
      });
      const data = await response.json();

      let savedRule: WorkshopLearnedRule | undefined;
      if (
        access.canManageLearningRules &&
        data.success &&
        data.reply?.extractedNewRule &&
        data.reply.extractedNewRule.instruction
      ) {
        savedRule = saveLearnedWorkshopRule(
          {
            triggerKeyword: data.reply.extractedNewRule.triggerKeyword || 'Custom Workshop Rule',
            instruction: data.reply.extractedNewRule.instruction,
            defaultParts: data.reply.extractedNewRule.defaultParts || [],
            videoCheckPrompt: data.reply.extractedNewRule.videoCheckPrompt,
          },
          currentRole
        );
        setLearnedRules(getLearnedWorkshopRules());
      } else if (access.canManageLearningRules && (low.startsWith('teach:') || low.startsWith('remember:'))) {
        const cleanRuleText = raw.replace(/^(teach|remember):\s*/i, '');
        savedRule = saveLearnedWorkshopRule(
          {
            triggerKeyword: 'Daily Manager Teaching',
            instruction: cleanRuleText,
            defaultParts: [],
            videoCheckPrompt: 'Record a 15-sec inspection video verifying this check.',
          },
          currentRole
        );
        setLearnedRules(getLearnedWorkshopRules());
      }

      const includePaint = data.reply?.suggestedActionType === 'PAINT_LIST';
      const includePurchase = data.reply?.suggestedActionType === 'PURCHASE_LIST';

      const aiMsg: AIChatMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: 'AI',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text:
          data.reply?.answer ||
          (savedRule
            ? `🧠 I have learned and saved this rule to the Workshop Knowledge Base: "${savedRule.instruction}". I will automatically apply it to future Job Cards and Cars24 PDFs.`
            : 'Processed your workshop request.'),
        learnedRule: savedRule,
        paintReport: includePaint ? generateCopyablePaintJobsSummary(undefined, currentRole) : undefined,
        purchaseReport: includePurchase ? generateConsolidatedPartsPurchaseList(undefined, currentRole) : undefined,
        followUpPrompts: data.reply?.followUpPrompts || [
          'Give me the list of paint jobs to copy and paste',
          "Give me today's total parts purchase list by vehicle",
        ],
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'AI',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `Here are the instant tools for your account (${access.userName} - ${access.role}): use the quick buttons above to view your role-scoped Paint List or Parts List.`,
        },
      ]);
    } finally {
      setIsProcessing(false);
      scrollToBottom();
    }
  };

  return (
    <div className="space-y-5">
      {/* Hidden File Inputs for Camera / Photo and PDF Job Cards */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        onChange={handleVehiclePhotoUpload}
        className="hidden"
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,image/*"
        onChange={handlePdfFileUpload}
        className="hidden"
      />

      {/* Top Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-600/30">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Gemini Multimodal Workshop Agent
                </span>
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Connected to Live Workshop DB ({learnedRules.length} Learned Rules)
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight mt-1">
                FixoCar AI Operations Co-Pilot & Smart Parser
              </h1>
              <p className="text-xs text-slate-300 mt-0.5 max-w-3xl">
                Snap incoming vehicle photos to detect Reg No & Make/Model, upload Cars24 PDFs to auto-create & allot Job Cards, copy all Paint Jobs in one click, or generate Vehicle-by-Vehicle + Today's Total Parts Purchase List.
              </p>
            </div>
          </div>

          {/* Primary Action Triggers (Scoped by Role Permissions) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="px-3.5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>📸 Scan Car Photo</span>
            </button>

            {access.canCreateJobCard ? (
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="px-3.5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <FileUp className="w-4 h-4" />
                <span>📄 Upload Cars24 PDF</span>
              </button>
            ) : (
              <span className="px-3 py-2 rounded-2xl bg-slate-800 border border-slate-700 text-amber-300 text-[11px] font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Account Scope: {access.userName} ({access.role}) • {scopedCards.length} Allotted Car(s)</span>
              </span>
            )}
          </div>
        </div>

        {/* Explicit Role & Database Permission Strip */}
        <div
          className={`mt-4 px-3.5 py-2 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
            access.isManagementRole
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              <strong>Logged-In Identity:</strong> {access.userName} ({access.role}) — {access.scopeDescription}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase">
            <span className={access.canCreateJobCard ? 'text-emerald-300' : 'text-rose-400'}>
              {access.canCreateJobCard ? '✓ Create Job Card' : '✕ Create Job Card Locked'}
            </span>
            <span>•</span>
            <span className={access.canEditOrDeleteTasks ? 'text-emerald-300' : 'text-rose-400'}>
              {access.canEditOrDeleteTasks ? '✓ Edit/Delete Tasks' : '✕ Edit/Delete Tasks Locked'}
            </span>
            <span>•</span>
            <span className={access.canViewFinancialsAndRates ? 'text-emerald-300' : 'text-rose-400'}>
              {access.canViewFinancialsAndRates ? '✓ Billing Rates Visible' : '✕ Billing Rates Hidden'}
            </span>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-800">
          {[
            { id: 'CHAT', label: '💬 AI Chat & Role Bot', icon: Bot },
            {
              id: 'PAINT_SHEET',
              label: access.isManagementRole
                ? `🎨 All Paint Jobs (${livePaintReport.totalPanels})`
                : `🎨 My Paint Panels (${livePaintReport.totalPanels})`,
              icon: Paintbrush,
            },
            {
              id: 'PURCHASE_SHEET',
              label: access.isManagementRole
                ? `🛒 Today's Purchase List (${livePurchaseReport.totalUniquePartsToBuy})`
                : `🛒 My Allotted Car Parts (${livePurchaseReport.totalUniquePartsToBuy})`,
              icon: ShoppingBag,
            },
            { id: 'RULES_AND_GUIDE', label: `🧠 Learned Rules & RBAC Guide (${learnedRules.length})`, icon: Brain },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubView(tab.id as any)}
                className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  active
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          VIEW 1: MULTIMODAL AI CHAT & ONE-CLICK JOB CARD / LIST GENERATOR
         ===================================================================== */}
      {activeSubView === 'CHAT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 8 Cols: Interactive Chat Stream */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col h-[680px] overflow-hidden">
            {/* Quick Action Toolbar inside Chat (Tailored to Role) */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1.5 shrink-0">
                {!access.isManagementRole && (
                  <button
                    type="button"
                    onClick={() => handleSendChat('Show my allotted vehicles and tasks')}
                    className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Car className="w-3.5 h-3.5" />
                    <span>My Allotted Cars ({scopedCards.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    handleSendChat(
                      access.isManagementRole
                        ? 'Give me the list of paint jobs to copy and paste'
                        : 'Give me the list of paint jobs allotted to me'
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-500/20 text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  <span>{access.isManagementRole ? 'Copyable Paint Jobs List' : 'My Paint Panels List'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSendChat(
                      access.isManagementRole
                        ? "Give me today's total parts purchase list by vehicle"
                        : 'Show parts required for my allotted vehicles'
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>{access.isManagementRole ? "Today's Parts Purchase List" : 'Parts for My Cars'}</span>
                </button>
                {access.canCreateJobCard ? (
                  <button
                    type="button"
                    onClick={() => handleSendChat('Simulate Cars24 PDF Job Card upload & auto-allotment')}
                    className="px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-500/20 text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Demo Cars24 PDF → Job Card</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendChat('What inspection videos do I need to record for my allotted cars?')}
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>My Video Checklists</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setMessages([buildWelcomeMessageForRole()]);
                  saveAIChatHistory([]);
                }}
                className="text-[11px] font-bold text-slate-400 hover:text-rose-500 shrink-0 px-2 py-1 cursor-pointer"
                title="Reset Chat History"
              >
                Clear Chat
              </button>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'USER' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 space-y-3 ${
                      msg.sender === 'USER'
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-4 text-[10px] opacity-75 font-bold">
                      <span>{msg.sender === 'USER' ? authUser?.name || 'You' : '🤖 FixoCar AI Workshop Agent'}</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {/* Uploaded Image Preview */}
                    {msg.attachmentPreviewUrl && (
                      <img
                        src={msg.attachmentPreviewUrl}
                        alt={msg.attachmentName || 'Uploaded vehicle'}
                        className="w-48 h-32 object-cover rounded-xl border border-white/20"
                      />
                    )}

                    {/* Message Text */}
                    <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-line font-medium">
                      {msg.text}
                    </div>

                    {/* 1. Vehicle Photo Analysis Result Card */}
                    {msg.vehicleAnalysis && (
                      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3 text-slate-900 dark:text-slate-100">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 border border-slate-700">
                              {msg.vehicleAnalysis.plateNumber}
                            </span>
                            <div>
                              <h4 className="font-black text-xs sm:text-sm">
                                {msg.vehicleAnalysis.make} {msg.vehicleAnalysis.model}{' '}
                                {msg.vehicleAnalysis.variant ? `(${msg.vehicleAnalysis.variant})` : ''}
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                {msg.vehicleAnalysis.color || 'White'} • {msg.vehicleAnalysis.fuelType || 'Petrol'} •{' '}
                                {msg.vehicleAnalysis.bodyType || 'Car'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {msg.vehicleAnalysis.visibleDamages && msg.vehicleAnalysis.visibleDamages.length > 0 && (
                          <div className="text-xs space-y-1">
                            <span className="text-[10px] font-black uppercase text-slate-400">Detected Exterior Panels / Jobs:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.vehicleAnalysis.visibleDamages.map((dmg, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[11px] font-bold"
                                >
                                  {dmg}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {msg.vehicleAnalysis.employeeVideoPrompts && msg.vehicleAnalysis.employeeVideoPrompts.length > 0 && (
                          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-800 dark:text-indigo-300 space-y-1">
                            <div className="font-black flex items-center gap-1">
                              <Video className="w-3.5 h-3.5" />
                              <span>Employee Video Check Prompt:</span>
                            </div>
                            {msg.vehicleAnalysis.employeeVideoPrompts.map((vp, idx) => (
                              <p key={idx}>• {vp}</p>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {msg.createdCheckInId ? (
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-black flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              Gate Check-In Logged ({msg.createdCheckInId})
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const checkIn = createGateCheckInFromAiPhoto(msg.vehicleAnalysis!);
                                setMessages((prev) =>
                                  prev.map((m) => (m.id === msg.id ? { ...m, createdCheckInId: checkIn.id } : m))
                                );
                              }}
                              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Log Gate Check-In ({msg.vehicleAnalysis.plateNumber})</span>
                            </button>
                          )}

                          {msg.createdJobCardId ? (
                            <button
                              type="button"
                              onClick={() => handleOpenCard(msg.createdJobCardId!)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Open Created Job Card ({msg.createdJobCardId}) →</span>
                            </button>
                          ) : access.canCreateJobCard ? (
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  const jc = createActionableJobCardFromAiPayload(
                                    {
                                      isCars24: true,
                                      registrationNumber: msg.vehicleAnalysis!.plateNumber,
                                      make: msg.vehicleAnalysis!.make,
                                      model: msg.vehicleAnalysis!.model,
                                      variant: msg.vehicleAnalysis!.variant,
                                      year: msg.vehicleAnalysis!.year || 2023,
                                      color: msg.vehicleAnalysis!.color || 'White',
                                      fuelType: msg.vehicleAnalysis!.fuelType || 'Petrol',
                                      workOrderSummary: msg.vehicleAnalysis!.summary,
                                      tasks: msg.vehicleAnalysis!.suggestedTasks || [],
                                      requiredParts: msg.vehicleAnalysis!.suggestedParts || [],
                                      employeeVideoPrompts: msg.vehicleAnalysis!.employeeVideoPrompts || [],
                                    },
                                    currentRole
                                  );
                                  setMessages((prev) =>
                                    prev.map((m) => (m.id === msg.id ? { ...m, createdJobCardId: jc.id } : m))
                                  );
                                } catch (e: any) {
                                  dispatchToastNotification({
                                    type: 'WARNING',
                                    title: 'Job Card Notice',
                                    message: e.message,
                                  });
                                }
                              }}
                              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Create Job Card & Auto-Allot Team</span>
                            </button>
                          ) : (
                            <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-bold">
                              🔒 Job Card Creation Restricted to Admin / Manager
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 2. Parsed Cars24 PDF / Work Order Card */}
                    {msg.parsedPdfJobCard && (
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-blue-500/30 space-y-3 text-slate-900 dark:text-slate-100">
                        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 dark:border-slate-800 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400">
                              {msg.parsedPdfJobCard.registrationNumber}
                            </span>
                            {msg.parsedPdfJobCard.isCars24 && (
                              <span className="px-2 py-0.5 rounded-md bg-orange-500 text-white text-[10px] font-black uppercase">
                                Cars24 PDF ({msg.parsedPdfJobCard.cars24RefNo || 'Refurb'})
                              </span>
                            )}
                            <span className="font-extrabold text-xs">
                              {msg.parsedPdfJobCard.make} {msg.parsedPdfJobCard.model} ({msg.parsedPdfJobCard.color})
                            </span>
                          </div>
                        </div>

                        {/* Extracted Tasks Preview */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Extracted Work Order Tasks ({msg.parsedPdfJobCard.tasks.length}):
                          </span>
                          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                            {msg.parsedPdfJobCard.tasks.map((t, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                                      t.category === 'PAINT'
                                        ? 'bg-pink-500/15 text-pink-600 dark:text-pink-300'
                                        : 'bg-blue-500/15 text-blue-600 dark:text-blue-300'
                                    }`}
                                  >
                                    {t.category}
                                  </span>
                                  <span className="font-bold truncate">{t.title}</span>
                                </div>
                                <span className="font-mono font-black text-xs shrink-0">
                                  ₹{Number(t.customerPrice || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Extracted Parts Preview */}
                        {msg.parsedPdfJobCard.requiredParts && msg.parsedPdfJobCard.requiredParts.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                              Parts Added to Purchase Queue ({msg.parsedPdfJobCard.requiredParts.length}):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.parsedPdfJobCard.requiredParts.map((rp, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-bold"
                                >
                                  {rp.name} (×{rp.quantity})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Employee Video Prompts */}
                        {msg.parsedPdfJobCard.employeeVideoPrompts && msg.parsedPdfJobCard.employeeVideoPrompts.length > 0 && (
                          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-800 dark:text-indigo-300 space-y-1">
                            <div className="font-black flex items-center gap-1">
                              <Video className="w-3.5 h-3.5" />
                              <span>Auto-Sent to Employees for Video Evidence of Additional Work:</span>
                            </div>
                            {msg.parsedPdfJobCard.employeeVideoPrompts.map((vp, idx) => (
                              <p key={idx}>• {vp}</p>
                            ))}
                          </div>
                        )}

                        {/* Action Button to Create Job Card & Allot */}
                        <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
                          {msg.createdJobCardId ? (
                            <button
                              type="button"
                              onClick={() => handleOpenCard(msg.createdJobCardId!)}
                              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Job Card {msg.createdJobCardId} Created & Allotted! Click to Open →</span>
                            </button>
                          ) : access.canCreateJobCard ? (
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  const created = createActionableJobCardFromAiPayload(
                                    msg.parsedPdfJobCard!,
                                    currentRole
                                  );
                                  setMessages((prev) =>
                                    prev.map((m) => (m.id === msg.id ? { ...m, createdJobCardId: created.id } : m))
                                  );
                                } catch (e: any) {
                                  dispatchToastNotification({
                                    type: 'WARNING',
                                    title: 'Job Card Notice',
                                    message: e.message,
                                  });
                                }
                              }}
                              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-98"
                            >
                              <Sparkles className="w-4 h-4" />
                              <span>⚡ Create Internal Job Card & Allot Painter, Denter & Mechanic Now</span>
                            </button>
                          ) : (
                            <div className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs font-bold text-slate-500">
                              🔒 Creating Job Cards from PDF is restricted to Admin & Floor Manager accounts.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 3. Copyable Paint Jobs Report inside Chat */}
                    {msg.paintReport && (
                      <div className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 border border-slate-700 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-pink-400 flex items-center gap-1.5">
                            <Paintbrush className="w-4 h-4" />
                            <span>Copy-Ready Paint Jobs Sheet ({msg.paintReport.totalPanels} Panels)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.paintReport!.copyableText, `chat-paint-${msg.id}`)}
                            className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedId === `chat-paint-${msg.id}` ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Paint List</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="text-[11px] font-mono bg-slate-950 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto border border-slate-800 text-slate-200">
                          {msg.paintReport.copyableText}
                        </pre>
                      </div>
                    )}

                    {/* 4. Copyable Vehicle-Wise + Consolidated Purchase Report inside Chat */}
                    {msg.purchaseReport && (
                      <div className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 border border-slate-700 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                            <ShoppingBag className="w-4 h-4" />
                            <span>
                              Vehicle-by-Vehicle & Today's Total Purchase List (₹
                              {msg.purchaseReport.grandTotalEstimatedCost.toLocaleString('en-IN')})
                            </span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => syncPurchaseReportToPartOrderBasket(msg.purchaseReport!)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black cursor-pointer"
                            >
                              + Push to Order Basket
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyText(msg.purchaseReport!.copyableText, `chat-purch-${msg.id}`)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                            >
                              {copiedId === `chat-purch-${msg.id}` ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy Purchase List</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        <pre className="text-[11px] font-mono bg-slate-950 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto border border-slate-800 text-slate-200">
                          {msg.purchaseReport.copyableText}
                        </pre>
                      </div>
                    )}

                    {/* 5. Newly Learned Rule Confirmation Badge */}
                    {msg.learnedRule && (
                      <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
                        <Brain className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-black">New Daily Teaching Saved to Workshop Memory:</div>
                          <div className="font-semibold mt-0.5">
                            [{msg.learnedRule.triggerKeyword}] — {msg.learnedRule.instruction}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Follow-up Quick Chips */}
                    {msg.followUpPrompts && msg.followUpPrompts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {msg.followUpPrompts.map((fp, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSendChat(fp)}
                            className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 text-[11px] font-bold transition-colors cursor-pointer text-left"
                          >
                            {fp}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isProcessing && (
                <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 px-3 py-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AI Workshop Agent is analyzing and updating workshop records...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Bottom Chat Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-amber-500 hover:border-amber-500 transition-colors shrink-0 cursor-pointer"
                title="Click or Upload Vehicle Photo"
              >
                <Camera className="w-4 h-4" />
              </button>
              {access.canCreateJobCard && (
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:border-blue-500 transition-colors shrink-0 cursor-pointer"
                  title="Upload Cars24 PDF Job Card or Estimate"
                >
                  <FileUp className="w-4 h-4" />
                </button>
              )}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  access.isManagementRole
                    ? "Ask for Paint List, Today's Parts Purchase List, or type 'Teach: When Creta comes...' "
                    : `Ask about your allotted cars (${access.userName}), required parts, or video checks...`
                }
                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isProcessing}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>

          {/* Right 4 Cols: Instant Copy-Paste Paint & Purchase Summary Cards */}
          <div className="lg:col-span-4 space-y-4">
            {/* Quick Card 1: One-Click Copy All Paint Jobs */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400">
                    <Paintbrush className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                      All Paint Jobs at One Place
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {livePaintReport.totalPanels} Panels across {livePaintReport.totalVehicles} Active Cars
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText(livePaintReport.copyableText, 'sidebar-paint')}
                  className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {copiedId === 'sidebar-paint' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'sidebar-paint' ? 'Copied!' : 'Copy List'}</span>
                </button>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {livePaintReport.vehicles.map((v) => (
                  <div
                    key={v.jobCardId}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="font-mono text-slate-900 dark:text-white">{v.registrationNumber}</span>
                      <span className="text-pink-600 dark:text-pink-400">{v.panels.length} Panels</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {v.vehicleLabel} ({v.color}) • P: {v.painterName} | D: {v.denterName}
                    </p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
                      {v.panels.map((p) => p.panelName).join(', ')}
                    </p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setActiveSubView('PAINT_SHEET')}
                className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Open Full Paint Copy-Paste Sheet →
              </button>
            </div>

            {/* Quick Card 2: Vehicle-by-Vehicle & Today's Total Purchase List */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                      Today's Total Purchase List
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {livePurchaseReport.vehicleGroups.length} Vehicles • Est. ₹
                      {livePurchaseReport.grandTotalEstimatedCost.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText(livePurchaseReport.copyableText, 'sidebar-purchase')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {copiedId === 'sidebar-purchase' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'sidebar-purchase' ? 'Copied!' : 'Copy List'}</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {livePurchaseReport.vehicleGroups.map((vg, idx) => (
                  <div
                    key={vg.jobCardId}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-black text-slate-900 dark:text-white">
                        #{idx + 1} {vg.registrationNumber}
                      </span>
                      <p className="text-[11px] text-slate-500 truncate">
                        {vg.vehicleLabel} • {vg.items.length} parts needed
                      </p>
                    </div>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                      ₹{vg.vehicleTotalPurchaseCost.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setActiveSubView('PURCHASE_SHEET')}
                className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Open Vehicle-Wise & Master Purchase Sheet →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 2: ALL PAINT JOBS AT ONE PLACE (COPY & PASTE SHEET)
         ===================================================================== */}
      {activeSubView === 'PAINT_SHEET' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Paintbrush className="w-5 h-5 text-pink-600" />
                <span>All Active Paint & Denting Jobs at One Place</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Grouped by vehicle with allotted Painter, Denter, panel scope, customer billing, and contractor payouts—ready to copy and paste.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={vehicleFilter}
                onChange={(e) => setVehicleFilter(e.target.value)}
                placeholder="Filter by Reg No or Model..."
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              />
              <button
                type="button"
                onClick={() => handleCopyText(livePaintReport.copyableText, 'full-paint-sheet')}
                className="px-4 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs flex items-center gap-2 shadow-sm cursor-pointer"
              >
                {copiedId === 'full-paint-sheet' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>
                  {copiedId === 'full-paint-sheet'
                    ? 'Copied Full Paint List!'
                    : '📋 Copy All Paint Jobs List'}
                </span>
              </button>
            </div>
          </div>

          {/* Copyable Raw Text Box */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              One-Click Copy / Paste Text Block (For WhatsApp / Floor Board):
            </span>
            <pre className="p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto whitespace-pre-wrap border border-slate-800 max-h-72 overflow-y-auto">
              {livePaintReport.copyableText}
            </pre>
          </div>

          {/* Vehicle-Wise Paint Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {livePaintReport.vehicles.map((v) => {
              const singleVehicleCopyText = [
                `🚗 *${v.registrationNumber}* — ${v.vehicleLabel} (${v.color}) [${v.jobCardId}]`,
                `Painter: ${v.painterName} | Denter: ${v.denterName}`,
                ...v.panels.map((p, idx) =>
                  access.canViewFinancialsAndRates
                    ? `${idx + 1}. ${p.panelName} (${p.paintScope}) — ₹${p.customerPrice.toLocaleString('en-IN')} [P: ₹${p.painterPayout} / D: ₹${p.denterPayout}]`
                    : `${idx + 1}. ${p.panelName} (${p.paintScope}) — Status: ${p.status}`
                ),
                ...(access.canViewFinancialsAndRates
                  ? [`Total (${v.panels.length} Panels): ₹${v.totalCustomerPrice.toLocaleString('en-IN')}`]
                  : [`Total Allotted Panels: ${v.panels.length}`]),
              ].join('\n');

              return (
                <div
                  key={v.jobCardId}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm px-2 py-0.5 rounded bg-slate-900 text-amber-400">
                          {v.registrationNumber}
                        </span>
                        <span className="font-black text-sm text-slate-900 dark:text-white">
                          {v.vehicleLabel} ({v.color})
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        👨‍🎨 Painter: <strong className="text-slate-800 dark:text-slate-200">{v.painterName}</strong> • 🔨 Denter:{' '}
                        <strong className="text-slate-800 dark:text-slate-200">{v.denterName}</strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyText(singleVehicleCopyText, `paint-veh-${v.jobCardId}`)}
                      className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-extrabold flex items-center gap-1 hover:border-pink-500 cursor-pointer"
                    >
                      {copiedId === `paint-veh-${v.jobCardId}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === `paint-veh-${v.jobCardId}` ? 'Copied' : 'Copy Car'}</span>
                    </button>
                  </div>

                  <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 px-3 py-1">
                    {v.panels.map((p) => (
                      <div key={p.taskId} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{p.panelName}</span>
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-600 dark:text-pink-300 font-bold">
                            {p.paintScope}
                          </span>
                        </div>
                        <div className="text-right font-mono">
                          {access.canViewFinancialsAndRates ? (
                            <>
                              <span className="font-black text-slate-900 dark:text-white">
                                ₹{p.customerPrice.toLocaleString('en-IN')}
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                P: ₹{p.painterPayout} | D: ₹{p.denterPayout}
                              </span>
                            </>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              {p.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 3: VEHICLE-BY-VEHICLE + TODAY'S TOTAL PARTS PURCHASE LIST
         ===================================================================== */}
      {activeSubView === 'PURCHASE_SHEET' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <span>Vehicle-by-Vehicle & Today's Consolidated Parts Purchase List</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                See the exact purchase list for Vehicle 1, then Vehicle 2, followed by the combined Grand Total Purchase List for today.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => syncPurchaseReportToPartOrderBasket(livePurchaseReport)}
                className="px-3.5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Push All to Part Order Basket</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyText(livePurchaseReport.copyableText, 'full-purchase-sheet')}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 shadow-sm cursor-pointer"
              >
                {copiedId === 'full-purchase-sheet' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>
                  {copiedId === 'full-purchase-sheet'
                    ? 'Copied Full Purchase List!'
                    : "📋 Copy Today's Full Purchase List"}
                </span>
              </button>
            </div>
          </div>

          {/* Section 1: Vehicle-by-Vehicle Purchase Lists */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              1. Purchase List by Individual Vehicle ({livePurchaseReport.vehicleGroups.length} Vehicles)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {livePurchaseReport.vehicleGroups.map((vg, idx) => {
                const singleVehText = [
                  `🚗 *Purchase List — Vehicle ${idx + 1}: ${vg.registrationNumber}* (${vg.vehicleLabel})`,
                  ...vg.items.map(
                    (it, i) =>
                      `${i + 1}. ${it.partName} [${it.partNumber}] — Qty: ${it.netToOrderQty} × ₹${it.unitCost.toLocaleString('en-IN')} = ₹${it.totalEstimatedCost.toLocaleString('en-IN')}`
                  ),
                  `Subtotal (${vg.registrationNumber}): ₹${vg.vehicleTotalPurchaseCost.toLocaleString('en-IN')}`,
                ].join('\n');

                return (
                  <div
                    key={vg.jobCardId}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">
                          Vehicle #{idx + 1} Purchase List
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-slate-900 text-amber-400">
                            {vg.registrationNumber}
                          </span>
                          <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                            {vg.vehicleLabel}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(singleVehText, `purch-veh-${vg.jobCardId}`)}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-extrabold flex items-center gap-1 hover:border-emerald-500 cursor-pointer"
                      >
                        {copiedId === `purch-veh-${vg.jobCardId}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === `purch-veh-${vg.jobCardId}` ? 'Copied' : 'Copy Vehicle List'}</span>
                      </button>
                    </div>

                    <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 px-3 py-1">
                      {vg.items.map((it, i) => (
                        <div key={i} className="py-2 flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{it.partName}</p>
                            <p className="text-[10px] text-slate-500 truncate">
                              SKU: {it.partNumber} • Task: {it.sourceTaskTitle}
                            </p>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <span className="font-black text-slate-900 dark:text-white">
                              Qty: {it.netToOrderQty} × ₹{it.unitCost.toLocaleString('en-IN')}
                            </span>
                            <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              = ₹{it.totalEstimatedCost.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs font-black pt-1">
                      <span className="text-slate-500">Vehicle Parts Subtotal:</span>
                      <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                        ₹{vg.vehicleTotalPurchaseCost.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Consolidated Total Purchase List for Today */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                📦 2. Consolidated Total Purchase List for Today (All Vehicles Combined)
              </h3>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono font-black text-xs">
                Grand Total Procurement: ₹{livePurchaseReport.grandTotalEstimatedCost.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Part / Consumable Name</th>
                    <th className="py-3 px-4">Vehicles Requiring</th>
                    <th className="py-3 px-4 text-center">In Stock</th>
                    <th className="py-3 px-4 text-center">Total Qty to Buy</th>
                    <th className="py-3 px-4 text-right">Est. Unit Cost</th>
                    <th className="py-3 px-4 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {livePurchaseReport.consolidatedItems.map((ci, idx) => (
                    <tr key={ci.partKey} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{ci.partName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{ci.partNumber} • {ci.category}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {ci.vehiclesUsing.map((v, vIdx) => (
                            <span
                              key={vIdx}
                              className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-mono font-bold text-[10px]"
                            >
                              {v.regNo} (×{v.qty})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-500">{ci.inStockQty}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono font-black">
                          {ci.netQuantityToBuy}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">₹{ci.unitCost.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                        ₹{ci.totalPurchaseCost.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 4: CONTINUOUS LEARNING RULES & ROLE-BY-ROLE UTILIZATION PLAYBOOK
         ===================================================================== */}
      {activeSubView === 'RULES_AND_GUIDE' && (
        <div className="space-y-6">
          {/* Role-by-Role Guide: How Admin, Workshop Manager, and Employees Use the AI Agent */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Admin Playbook */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    For Workshop Admin / Owner
                  </span>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Financial, Procurement & Rate Control
                  </h3>
                </div>
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                <li>
                  • <strong>Consolidated Daily Purchase Budget</strong>: Instead of ordering parts piecemeal per car, generate the Vehicle-by-Vehicle + Consolidated Daily Purchase List every morning to negotiate bulk vendor discounts.
                </li>
                <li>
                  • <strong>Cars24 PDF Billing Audit</strong>: Drop Cars24 work orders in chat to ensure every refurbishment panel and mechanical job is billed at the right rate and paired with fixed Painter/Denter payouts.
                </li>
                <li>
                  • <strong>Institutional Memory</strong>: Teach the AI your standard operating rules once, and it enforces them across every advisor and technician automatically.
                </li>
              </ul>
            </div>

            {/* 2. Workshop / Floor Manager Playbook */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    For Workshop / Floor Manager
                  </span>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Zero-Friction Intake, Allotment & QC
                  </h3>
                </div>
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                <li>
                  • <strong>30-Second Gate-to-Job-Card</strong>: Snap a photo of the arriving vehicle at the gate → AI reads the plate & model → upload the Cars24 PDF → AI creates the Job Card and allots the least-loaded Painter, Denter & Mechanic.
                </li>
                <li>
                  • <strong>1-Click Paint Booth Schedule</strong>: Copy the formatted Paint Jobs List and share it in the morning huddle or WhatsApp group so Painters and Denters know their exact panel queue.
                </li>
                <li>
                  • <strong>Automated Video Follow-ups</strong>: The bot automatically tags which hidden components need a 15-sec video from the technician so supplementary approvals are never missed.
                </li>
              </ul>
            </div>

            {/* 3. Employee (Painter / Denter / Mechanic) Playbook */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    For Employees (Painters, Denters, Mechanics)
                  </span>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Guided Checks, Parts & Proof Videos
                  </h3>
                </div>
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                <li>
                  • <strong>Clear Panel & Task Queue</strong>: Painters and Denters immediately see their allotted panels, paint scope (Full Outer vs Touchup), and per-panel payout on their Role Workspace.
                </li>
                <li>
                  • <strong>AI Inspection Checklist & Video Prompts</strong>: When a car is allotted, the employee sees exact AI prompts (e.g. <em>"Record 15-sec video of Lower Arm Bushes & Radiator Support"</em>) to capture proof for additional jobs.
                </li>
                <li>
                  • <strong>Pre-Matched Spare Parts</strong>: Required filters, brake pads, clips, and paint kits are already attached to the task so technicians don't waste bay time waiting at the store counter.
                </li>
              </ul>
            </div>
          </div>

          {/* Learned Workshop Rules Manager (Continuous Daily Teaching) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5 shadow-xs">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-600" />
                <span>Continuous Workshop Learning Memory (Teach the AI Bot)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Add daily teachings here (or directly in the chat by starting a message with <code>Teach: ...</code>). The AI applies these rules whenever a matching vehicle photo or Cars24 PDF is uploaded.
              </p>
            </div>

            {/* Add New Teaching Form (Restricted to Admin / Floor Manager) */}
            {access.canManageLearningRules ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newRuleInstruction.trim()) return;
                  saveLearnedWorkshopRule(
                    {
                      triggerKeyword: newRuleTrigger.trim() || 'General Workshop Rule',
                      instruction: newRuleInstruction.trim(),
                      defaultParts: newRuleParts
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                      videoCheckPrompt: newRuleVideoPrompt.trim() || undefined,
                    },
                    currentRole
                  );
                  setLearnedRules(getLearnedWorkshopRules());
                  setNewRuleTrigger('');
                  setNewRuleInstruction('');
                  setNewRuleParts('');
                  setNewRuleVideoPrompt('');
                  dispatchToastNotification({
                    type: 'SUCCESS',
                    title: '🧠 Workshop Rule Learned',
                    message: 'The AI Agent will now apply this rule to future inspections and PDF job cards.',
                  });
                }}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
              >
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Vehicle / Job Trigger
                  </label>
                  <input
                    type="text"
                    value={newRuleTrigger}
                    onChange={(e) => setNewRuleTrigger(e.target.value)}
                    placeholder="e.g. Hyundai Creta Front Bumper"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    What Should the AI Check / Allot?
                  </label>
                  <input
                    type="text"
                    value={newRuleInstruction}
                    onChange={(e) => setNewRuleInstruction(e.target.value)}
                    placeholder="e.g. Always check radiator support & headlight brackets"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                    required
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Auto-Add Parts (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newRuleParts}
                    onChange={(e) => setNewRuleParts(e.target.value)}
                    placeholder="e.g. Bumper Clips (10x), Bracket"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Teach AI</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  Read-Only View ({access.userName} • {access.role}): Adding or deleting global Workshop AI Learning Rules is restricted to Admin and Floor Manager accounts.
                </span>
              </div>
            )}

            {/* Saved Learned Rules List */}
            <div className="space-y-2.5">
              {learnedRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-black uppercase">
                        {rule.triggerKeyword}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Taught by {rule.createdBy} on {rule.createdAt}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{rule.instruction}</p>
                    {rule.defaultParts && rule.defaultParts.length > 0 && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        🛒 Auto-Suggested Parts: {rule.defaultParts.join(', ')}
                      </p>
                    )}
                    {rule.videoCheckPrompt && (
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                        📹 Employee Video Prompt: {rule.videoCheckPrompt}
                      </p>
                    )}
                  </div>
                  {access.canManageLearningRules && (
                    <button
                      type="button"
                      onClick={() => setLearnedRules(deleteLearnedWorkshopRule(rule.id, currentRole))}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
