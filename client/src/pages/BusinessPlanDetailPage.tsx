import { useState, useRef, useEffect } from "react";
import MarkdownLite from "@/components/MarkdownLite";
import { mdToPlain } from "@shared/markdownText";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Sparkles,
  CheckCircle,
  Circle,
  FileText,
  Copy,
  Download,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SelfCheckPanel from "@/components/SelfCheckPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sectionId?: string;
  timestamp: number;
};

type InputData = Record<string, string[]>;

type GeneratedSection = {
  sectionId: string;
  title: string;
  content: string;
};

const SECTION_LABELS: Record<string, string> = {
  overview: "Ⅰ. 사업 개요",
  background: "Ⅱ. 사업 배경 및 필요성",
  target: "Ⅲ. 사업 대상",
  goal: "Ⅳ. 사업 목적 및 목표",
  content: "Ⅴ. 사업 내용",
  outcome: "Ⅵ. 성과목표 및 평가",
  budget: "Ⅶ. 예산 계획",
};

export default function BusinessPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const planId = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();

  const [inputText, setInputText] = useState("");
  const [activeSectionId, setActiveSectionId] = useState("overview");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputData, setInputData] = useState<InputData>({});
  const [generatedSections, setGeneratedSections] = useState<GeneratedSection[]>([]);
  const [activeTab, setActiveTab] = useState<"chat" | "result">("chat");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 인라인 편집 상태
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const { data: plan, isLoading } = trpc.businessPlans.get.useQuery(
    { id: planId },
    { enabled: !!planId }
  );

  // 서버 데이터 로드 시 상태 싱크
  useEffect(() => {
    if (!plan) return;
    if (plan.chatHistory.length > 0) setChatHistory(plan.chatHistory);
    if (Object.keys(plan.inputData).length > 0) setInputData(plan.inputData);
    if (plan.generatedContent.length > 0) {
      setGeneratedSections(plan.generatedContent);
      if (plan.status === "completed") setActiveTab("result");
    }
    // 마지막으로 작성 중인 섹션으로 이동
    const sections = Object.keys(SECTION_LABELS);
    for (const sId of sections) {
      if (!plan.inputData[sId] || plan.inputData[sId].length === 0) {
        setActiveSectionId(sId);
        break;
      }
    }
  }, [plan?.id]); // plan.id가 바뀌었을 때만 실행

  const { data: sectionsData } = trpc.businessPlans.getSections.useQuery();
  const { data: questionsData } = trpc.businessPlans.getQuestions.useQuery(
    { sectionId: activeSectionId },
    { enabled: !!activeSectionId }
  );

  const utils = trpc.useUtils();

  const chatMutation = trpc.businessPlans.chat.useMutation({
    onSuccess: (data) => {
      setChatHistory(data.chatHistory);
      setInputData(data.inputData);
      setInputText("");
    },
    onError: () => toast.error("메시지 전송에 실패했습니다."),
  });

  const generateMutation = trpc.businessPlans.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedSections(data.sections);
      setActiveTab("result");
      toast.success("사업계획서 최종본이 생성되었습니다!");
    },
    onError: () => toast.error("생성에 실패했습니다. 다시 시도해주세요."),
  });

  const regenerateQuickMutation = trpc.businessPlans.regenerateQuick.useMutation({
    onSuccess: (data) => {
      setGeneratedSections(data.sections);
      utils.businessPlans.get.invalidate({ id: planId });
      toast.success("같은 입력으로 다시 생성했습니다.");
    },
    onError: (e) => toast.error(e.message || "생성에 실패했습니다."),
  });
  const isQuickPlan = !!plan?.inputData?._quick?.[0];
  const regenerate = () =>
    isQuickPlan ? regenerateQuickMutation.mutate({ planId }) : generateMutation.mutate({ planId });
  const regenerating = generateMutation.isPending || regenerateQuickMutation.isPending;
  const savedSelfCheck = (() => {
    try {
      const raw = plan?.inputData?._selfCheck?.[0];
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const updateSectionMutation = trpc.businessPlans.updateSection.useMutation({
    onSuccess: () => {
      toast.success("섹션이 저장되었습니다.");
      setEditingSectionId(null);
      setEditingContent("");
      // 서버 기준으로 재검증
      utils.businessPlans.get.invalidate({ id: planId });
    },
    onError: (_err, variables) => {
      toast.error("저장에 실패했습니다. 이전 내용으로 복원됩니다.");
      // 낙관적 업데이트 롤백: 서버 데이터로 재동기화
      utils.businessPlans.get.invalidate({ id: planId });
    },
  });

  // 채팅 스크롤 자동 이동
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // 첫 메시지 (섹션 변경 시 첫 질문 표시)
  useEffect(() => {
    if (!sectionsData || !questionsData) return;
    const sectionMessages = chatHistory.filter((m) => m.sectionId === activeSectionId);
    if (sectionMessages.length === 0) {
      const section = sectionsData.find((s) => s.id === activeSectionId);
      if (section && questionsData.length > 0) {
        const firstQ = questionsData[0];
        const welcomeMsg: ChatMessage = {
          role: "assistant",
          content: `**${section.title}** 섹션을 시작합니다.\n\n**${firstQ.question}**\n\n${firstQ.hint ? `💡 ${firstQ.hint}` : ""}`,
          sectionId: activeSectionId,
          timestamp: Date.now(),
        };
        const alreadyHas = chatHistory.some(
          (m) => m.sectionId === activeSectionId && m.role === "assistant"
        );
        if (!alreadyHas) {
          setChatHistory((prev) => [...prev, welcomeMsg]);
        }
      }
    }
  }, [activeSectionId, sectionsData, questionsData]);

  const handleSend = () => {
    if (!inputText.trim() || chatMutation.isPending) return;
    chatMutation.mutate({
      planId,
      userMessage: inputText.trim(),
      sectionId: activeSectionId,
      chatHistory,
      inputData,
    });
  };

  const handleCopyAll = () => {
    const text = generatedSections
      .map((s) => `■ ${s.title}\n\n${mdToPlain(s.content)}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    toast.success("클립보드에 복사되었습니다.");
  };

  const handleDownload = () => {
    const text = generatedSections
      .map((s) => `■ ${s.title}\n\n${mdToPlain(s.content)}`)
      .join("\n\n---\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan?.title ?? '사업계획서'}_${plan?.year ?? ''}년_사업계획서.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("다운로드가 시작되었습니다.");
  };

  // 편집 시작
  const handleEditStart = (section: GeneratedSection) => {
    setEditingSectionId(section.sectionId);
    setEditingContent(section.content);
  };

  // 편집 취소
  const handleEditCancel = () => {
    setEditingSectionId(null);
    setEditingContent("");
  };

  // 편집 저장
  const handleEditSave = (sectionId: string) => {
    // 로컬 상태 즉시 업데이트 (낙관적 업데이트)
    setGeneratedSections((prev) =>
      prev.map((s) => (s.sectionId === sectionId ? { ...s, content: editingContent } : s))
    );
    // DB 저장
    updateSectionMutation.mutate({ planId, sectionId, content: editingContent });
  };

  const getSectionProgress = (sectionId: string) => {
    const answers = inputData[sectionId] ?? [];
    const total = sectionsData?.find((s) => s.id === sectionId)?.fields.length ?? 0;
    return { answered: Math.min(answers.length, total), total };
  };

  const isAllSectionsComplete = () => {
    if (!sectionsData) return false;
    return sectionsData.every((s) => {
      const answers = inputData[s.id] ?? [];
      return answers.length >= s.fields.length;
    });
  };

  // 현재 섹션의 채팅 메시지만 필터링
  const currentSectionMessages = chatHistory.filter(
    (m) => !m.sectionId || m.sectionId === activeSectionId
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  if (!plan) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center text-muted-foreground">
          사업계획서를 찾을 수 없습니다.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* 상단 헤더 */}
        <div className="flex items-center gap-3 px-6 py-4 border-b bg-background shrink-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/business-plans")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-lg truncate">{plan.title}</h1>
            <p className="text-sm text-muted-foreground">{plan.year}년 사업계획서</p>
          </div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "chat" | "result")}>
            <TabsList>
              <TabsTrigger value="chat">대화형 입력</TabsTrigger>
              <TabsTrigger value="result" disabled={generatedSections.length === 0}>
                최종본
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {activeTab === "chat" ? (
          <div className="flex flex-1 overflow-hidden">
            {/* 좌측: 섹션 네비게이션 */}
            <div className="w-56 shrink-0 border-r overflow-y-auto bg-muted/30 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-2 mb-2">작성 섹션</p>
              {(sectionsData ?? Object.entries(SECTION_LABELS).map(([id, title]) => ({ id, title, questions: [] }))).map(
                (section) => {
                  const { answered, total } = getSectionProgress(section.id);
                  const isComplete = total > 0 && answered >= total;
                  const isActive = activeSectionId === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSectionId(section.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-start gap-2",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      {isComplete ? (
                        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4 shrink-0 mt-0.5 opacity-40" />
                      )}
                      <span className="flex-1 leading-tight">{section.title}</span>
                      {total > 0 && (
                        <span className={cn("text-xs shrink-0", isActive ? "opacity-80" : "text-muted-foreground")}>
                          {answered}/{total}
                        </span>
                      )}
                    </button>
                  );
                }
              )}

              {/* 최종 생성 버튼 */}
              <div className="pt-3 border-t mt-3">
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => generateMutation.mutate({ planId })}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <>
                      <Spinner className="w-3.5 h-3.5 mr-2" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 mr-2" />
                      최종본 생성
                    </>
                  )}
                </Button>
                {!isAllSectionsComplete() && (
                  <p className="text-xs text-muted-foreground text-center mt-1.5">
                    모든 섹션 입력 후 생성 권장
                  </p>
                )}
              </div>
            </div>

            {/* 우측: 채팅 영역 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 섹션 제목 */}
              <div className="px-4 py-3 border-b bg-muted/20 shrink-0">
                <h2 className="font-medium text-sm">
                  {SECTION_LABELS[activeSectionId] ?? activeSectionId}
                </h2>
                {(() => {
                  const { answered, total } = getSectionProgress(activeSectionId);
                  return total > 0 ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary rounded-full h-1.5 transition-all"
                          style={{ width: `${Math.min(100, (answered / total) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {answered}/{total} 완료
                      </span>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* 메시지 목록 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {currentSectionMessages.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    아래에 답변을 입력하면 AI가 다음 질문을 안내합니다.
                  </div>
                )}
                {currentSectionMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed", msg.role === "user" && "whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}
                    >
                      {msg.role === "user" ? msg.content : <MarkdownLite text={msg.content} />}
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                      <Spinner className="w-4 h-4" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* 입력창 */}
              <div className="p-4 border-t bg-background shrink-0">
                <div className="flex gap-2 items-end">
                  <Textarea
                    placeholder="답변을 입력하세요... (Shift+Enter: 줄바꿈, Enter: 전송)"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="resize-none min-h-[60px] max-h-[160px]"
                    rows={2}
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!inputText.trim() || chatMutation.isPending}
                    className="shrink-0 h-10 w-10"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 최종본 탭 */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">{plan.title}</h2>
                  <p className="text-muted-foreground text-sm">{plan.year}년 사업계획서 최종본</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    각 섹션 우측의 <Pencil className="inline w-3 h-3" /> 버튼을 클릭하면 내용을 직접 수정할 수 있습니다.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    다운로드
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopyAll}>
                    <Copy className="w-4 h-4 mr-2" />
                    전체 복사
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (window.confirm("다시 생성하면 직접 수정한 내용이 모두 사라집니다. 계속할까요?")) regenerate();
                    }}
                    disabled={regenerating}
                  >
                    {regenerating ? (
                      <Spinner className="w-4 h-4 mr-2" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    재생성
                  </Button>
                </div>
              </div>

              <SelfCheckPanel planId={planId} saved={savedSelfCheck} />

              <div className="space-y-6">
                {generatedSections.map((section) => {
                  const isEditing = editingSectionId === section.sectionId;
                  const isSaving =
                    updateSectionMutation.isPending &&
                    updateSectionMutation.variables?.sectionId === section.sectionId;

                  return (
                    <Card key={section.sectionId} className={cn(isEditing && "ring-2 ring-primary")}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {SECTION_LABELS[section.sectionId] ?? section.title}
                          </CardTitle>
                          {!isEditing ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleEditStart(section)}
                              title="이 섹션 편집"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={handleEditCancel}
                                title="취소"
                                disabled={isSaving}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="default"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEditSave(section.sectionId)}
                                title="저장"
                                disabled={isSaving}
                              >
                                {isSaving ? (
                                  <Spinner className="w-3.5 h-3.5" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isEditing ? (
                          <Textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="min-h-[200px] text-sm leading-relaxed resize-y font-mono"
                            autoFocus
                          />
                        ) : section.content ? (
                          <div
                            className="text-foreground cursor-text hover:bg-muted/30 rounded-md p-2 -m-2 transition-colors"
                            onClick={() => handleEditStart(section)}
                            title="클릭하여 편집"
                          >
                            <MarkdownLite text={section.content} />
                          </div>
                        ) : (
                          <p
                            className="text-sm text-muted-foreground italic cursor-text hover:bg-muted/30 rounded-md p-2 -m-2 transition-colors"
                            onClick={() => handleEditStart(section)}
                            title="클릭하여 편집"
                          >
                            이 섹션의 내용이 생성되지 않았습니다. 클릭하여 직접 입력하세요.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={() => setActiveTab("chat")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  대화형 입력으로 돌아가기
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
