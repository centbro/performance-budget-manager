import { useState, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Download,
  Phone,
  MapPin,
  Globe,
  CreditCard,
  Search,
  X,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import * as XLSX from "xlsx";
import { KIND_LABEL, TEMPLATE_HEADERS, parseParticipantRows, type ImportRow, type ParticipantKind } from "@shared/participantImport";
import { ClipboardCheck } from "lucide-react";

type ParticipantForm = {
  kind: ParticipantKind;
  name: string;
  gender: "male" | "female";
  nationality: string;
  phone: string;
  visaType: string;
  region: string;
  birthDate: string;
  note: string;
  classIds: number[];
};

const defaultForm: ParticipantForm = {
  kind: "foreigner",
  name: "",
  gender: "male",
  nationality: "",
  phone: "",
  visaType: "",
  region: "",
  birthDate: "",
  note: "",
  classIds: [],
};

/** 샘플 엑셀 파일 다운로드 (내국인/외국인 양식) */
function downloadSampleExcel(kind: ParticipantKind) {
  const wb = XLSX.utils.book_new();
  const rows =
    kind === "foreigner"
      ? [
          ["홍길동", "남", "베트남", "010-1234-5678", "E-9", "경기", "1990-03-15", "한국어 초급A", ""],
          ["김영희", "여", "중국", "010-9876-5432", "F-6", "서울", "1985-11-02", "한국어 초급A", "결혼이민"],
        ]
      : [
          ["이철수", "남", "1975-06-20", "010-1111-2222", "화성시 향남읍", "컴퓨터반", ""],
          ["박지현", "여", "1982-01-09", "010-3333-4444", "화성시 동탄", "컴퓨터반", "자원봉사자"],
        ];
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS[kind], ...rows]);
  ws["!cols"] = TEMPLATE_HEADERS[kind].map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, kind === "foreigner" ? "외국인" : "내국인");
  XLSX.writeFile(wb, `참여자_등록_양식_${KIND_LABEL[kind]}.xlsx`);
}

export default function ParticipantsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId ?? "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: participants = [], isLoading } = trpc.participants.list.useQuery({ projectId });

  // 검색·필터 상태
  const { data: classes = [] } = trpc.attendance.classes.useQuery({ projectId });
  const { data: classMap = {} } = trpc.attendance.classMap.useQuery({ projectId });
  const [filterKind, setFilterKind] = useState<"all" | ParticipantKind>("all");
  const [importKind, setImportKind] = useState<ParticipantKind>("foreigner");
  const [searchName, setSearchName] = useState("");
  const [filterNationality, setFilterNationality] = useState("all");
  const [filterVisaType, setFilterVisaType] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");

  // 필터 옵션 목록 (등록된 값 기반 동적 생성)
  const nationalityOptions = useMemo(() => {
    const set = new Set(participants.map((p) => p.nationality).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [participants]);
  const visaTypeOptions = useMemo(() => {
    const set = new Set(participants.map((p) => p.visaType).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [participants]);
  const regionOptions = useMemo(() => {
    const set = new Set(participants.map((p) => p.region).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [participants]);

  // 필터링된 대상자 목록
  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      if (filterKind !== "all" && p.kind !== filterKind) return false;
      if (searchName && !p.name.toLowerCase().includes(searchName.toLowerCase())) return false;
      if (filterNationality !== "all" && p.nationality !== filterNationality) return false;
      if (filterVisaType !== "all" && p.visaType !== filterVisaType) return false;
      if (filterRegion !== "all" && p.region !== filterRegion) return false;
      return true;
    });
  }, [participants, filterKind, searchName, filterNationality, filterVisaType, filterRegion]);

  const isFiltered = filterKind !== "all" || searchName || filterNationality !== "all" || filterVisaType !== "all" || filterRegion !== "all";

  const resetFilters = () => {
    setFilterKind("all");
    setSearchName("");
    setFilterNationality("all");
    setFilterVisaType("all");
    setFilterRegion("all");
  };

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<(typeof participants)[0] | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState<ParticipantForm>(defaultForm);

  // 엑셀 업로드 상태
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMutation = trpc.participants.create.useMutation({
    onSuccess: () => {
      utils.participants.list.invalidate();
      utils.attendance.classMap.invalidate();
      utils.attendance.classes.invalidate();
      setIsFormOpen(false);
      setForm(defaultForm);
      toast.success("대상자가 등록되었습니다.");
    },
    onError: () => toast.error("대상자 등록에 실패했습니다."),
  });

  const updateMutation = trpc.participants.update.useMutation({
    onSuccess: () => {
      utils.participants.list.invalidate();
      utils.attendance.classMap.invalidate();
      utils.attendance.classes.invalidate();
      setEditingParticipant(null);
      setIsFormOpen(false);
      toast.success("대상자 정보가 수정되었습니다.");
    },
    onError: () => toast.error("대상자 수정에 실패했습니다."),
  });

  const deleteMutation = trpc.participants.delete.useMutation({
    onSuccess: () => {
      utils.participants.list.invalidate();
      setDeletingId(null);
      toast.success("대상자가 삭제되었습니다.");
    },
    onError: () => toast.error("대상자 삭제에 실패했습니다."),
  });

  const bulkCreateMutation = trpc.participants.bulkCreate.useMutation({
    onSuccess: (data) => {
      utils.participants.list.invalidate();
      utils.attendance.classMap.invalidate();
      utils.attendance.classes.invalidate();
      setIsImportOpen(false);
      setParsedRows([]);
      setFileName("");
      toast.success(`${data.inserted}명이 등록되었습니다.${data.assigned ? ` (반 배정 ${data.assigned}명)` : ""}`);
    },
    onError: (err) => toast.error(`대량 등록 실패: ${err.message}`),
  });

  const handleOpenCreate = (kind: ParticipantKind = filterKind === "domestic" ? "domestic" : "foreigner") => {
    setForm({ ...defaultForm, kind });
    setEditingParticipant(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (p: (typeof participants)[0]) => {
    setForm({
      kind: (p.kind === "domestic" ? "domestic" : "foreigner") as ParticipantKind,
      birthDate: p.birthDate ?? "",
      note: p.note ?? "",
      classIds: (classMap[p.id] ?? []).map((c) => c.id),
      name: p.name,
      gender: p.gender,
      nationality: p.nationality ?? "",
      phone: p.phone ?? "",
      visaType: p.visaType ?? "",
      region: p.region ?? "",
    });
    setEditingParticipant(p);
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("이름을 입력해 주세요.");
      return;
    }
    if (form.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate)) {
      toast.error("생년월일을 확인해 주세요.");
      return;
    }
    const foreign = form.kind === "foreigner";
    const payload = {
      kind: form.kind,
      name: form.name.trim(),
      gender: form.gender,
      nationality: foreign ? form.nationality.trim() || undefined : undefined,
      phone: form.phone.trim() || undefined,
      visaType: foreign ? form.visaType.trim() || undefined : undefined,
      region: form.region.trim() || undefined,
      birthDate: form.birthDate || undefined,
      note: form.note.trim() || undefined,
    };
    if (editingParticipant) {
      updateMutation.mutate({
        id: editingParticipant.id,
        ...payload,
        nationality: payload.nationality ?? null,
        visaType: payload.visaType ?? null,
        phone: payload.phone ?? null,
        region: payload.region ?? null,
        birthDate: payload.birthDate ?? null,
        note: payload.note ?? null,
        classIds: form.classIds,
      });
    } else {
      createMutation.mutate({ projectId, ...payload, classIds: form.classIds });
    }
  };

  /** 엑셀 파일 파싱 */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        const parsed = parseParticipantRows(rows, importKind);

        if (parsed.length === 0) {
          toast.error("파일에서 유효한 데이터를 찾을 수 없습니다.");
          setParsedRows([]);
        } else {
          setParsedRows(parsed);
        }
      } catch {
        toast.error("파일을 읽는 중 오류가 발생했습니다. 올바른 엑셀 파일인지 확인해 주세요.");
        setParsedRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const validRows = parsedRows.filter((r) => !r.error);
  const errorRows = parsedRows.filter((r) => r.error);

  const handleBulkImport = () => {
    if (validRows.length === 0) {
      toast.error("등록 가능한 데이터가 없습니다.");
      return;
    }
    bulkCreateMutation.mutate({
      projectId,
      participants: validRows.map((r) => ({
        kind: importKind,
        name: r.name,
        gender: r.gender,
        nationality: r.nationality,
        phone: r.phone,
        visaType: r.visaType,
        region: r.region,
        birthDate: r.birthDate,
        note: r.note,
        className: r.className,
      })),
    });
  };

  const maleCount = filteredParticipants.filter((p) => p.gender === "male").length;
  const femaleCount = filteredParticipants.filter((p) => p.gender === "female").length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setLocation("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-[12rem]">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">대상자 관리</h1>
          {project && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {project.projectName} · 대상자는 큰 사업 단위로 관리됩니다
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setParsedRows([]); setFileName(""); setIsImportOpen(true); }}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            엑셀 가져오기
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLocation(`/attendance/${projectId}`)}>
            <ClipboardCheck className="h-4 w-4 mr-1.5" />
            출석부
          </Button>
          <Button onClick={() => handleOpenCreate()} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            대상자 등록
          </Button>
        </div>
      </div>

      {/* 검색·필터 영역 */}
      {participants.length > 0 && (
        <div className="space-y-3">
          <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-sm">
            {([["all", "전체"], ["foreigner", "외국인"], ["domestic", "내국인"]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilterKind(k)}
                className={`px-3 py-1 rounded ${filterKind === k ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
              >
                {label} <span className="text-xs text-muted-foreground">{k === "all" ? participants.length : participants.filter((p) => p.kind === k).length}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {/* 이름 검색 */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="이름으로 검색..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full h-9 pl-8 pr-8 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
              />
              {searchName && (
                <button onClick={() => setSearchName("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* 국적 필터 */}
            {nationalityOptions.length > 0 && (
              <Select value={filterNationality} onValueChange={setFilterNationality}>
                <SelectTrigger className="h-9 min-w-[130px] w-auto text-sm">
                  <Globe className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="국적" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 국적</SelectItem>
                  {nationalityOptions.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* 비자종류 필터 */}
            {visaTypeOptions.length > 0 && (
              <Select value={filterVisaType} onValueChange={setFilterVisaType}>
                <SelectTrigger className="h-9 min-w-[130px] w-auto text-sm">
                  <CreditCard className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="비자종류" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 비자</SelectItem>
                  {visaTypeOptions.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* 거주지역 필터 */}
            {regionOptions.length > 0 && (
              <Select value={filterRegion} onValueChange={setFilterRegion}>
                <SelectTrigger className="h-9 min-w-[130px] w-auto text-sm">
                  <MapPin className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="거주지역" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 지역</SelectItem>
                  {regionOptions.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* 필터 초기화 */}
            {isFiltered && (
              <button
                onClick={resetFilters}
                className="h-9 px-3 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                초기화
              </button>
            )}
          </div>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label={isFiltered ? `검색 결과` : "실인원(등록)"}
              value={filteredParticipants.length}
              unit={isFiltered ? `/${participants.length}명` : "명"}
              color="text-foreground"
            />
            <StatCard label="남성" value={maleCount} unit="명" color="text-blue-600" />
            <StatCard label="여성" value={femaleCount} unit="명" color="text-rose-500" />
          </div>
        </div>
      )}

      {/* Participants List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : participants.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              등록된 대상자가 없습니다.<br />대상자를 등록해 주세요.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setParsedRows([]); setFileName(""); setIsImportOpen(true); }}>
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                엑셀로 가져오기
              </Button>
              <Button size="sm" onClick={() => handleOpenCreate()}>
                <Plus className="h-4 w-4 mr-1.5" />
                직접 등록하기
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : filteredParticipants.length === 0 && isFiltered ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Filter className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              검색 조건에 맞는 대상자가 없습니다.
            </p>
            <button onClick={resetFilters} className="text-sm text-primary hover:underline">
              필터 초기화
            </button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground w-10">#</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">이름</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">구분</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">성별</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">반</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">국적</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">전화번호</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">비자종류</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">거주지역</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredParticipants.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                          p.gender === "male" ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-600"
                        }`}>
                          {idx + 1}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">{p.kind === "domestic" ? "내국인" : "외국인"}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs ${p.gender === "male" ? "border-blue-200 text-blue-600 bg-blue-50" : "border-rose-200 text-rose-500 bg-rose-50"}`}
                        >
                          {p.gender === "male" ? "남" : "여"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {(classMap[p.id] ?? []).length ? (classMap[p.id] ?? []).map((c) => c.name).join(", ") : <span className="text-muted-foreground/40">-</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.nationality ? (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3 shrink-0" />
                            {p.nationality}
                          </span>
                        ) : <span className="text-muted-foreground/40">-</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 shrink-0" />
                            {p.phone}
                          </span>
                        ) : <span className="text-muted-foreground/40">-</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.visaType ? (
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3 w-3 shrink-0" />
                            {p.visaType}
                          </span>
                        ) : <span className="text-muted-foreground/40">-</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.region ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {p.region}
                          </span>
                        ) : <span className="text-muted-foreground/40">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(p)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeletingId(p.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 엑셀 가져오기 다이얼로그 */}
      <Dialog open={isImportOpen} onOpenChange={(open) => {
        if (!open) { setIsImportOpen(false); setParsedRows([]); setFileName(""); }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              엑셀로 대상자 대량 등록
            </DialogTitle>
            <DialogDescription>
              {importKind === "foreigner"
                ? "이름·성별(필수), 국적, 전화번호, 비자종류, 거주지역, 생년월일, 반, 비고. 반 이름을 쓰면 없는 반은 자동으로 만들어 배정합니다."
                : "이름·성별(필수), 생년월일, 전화번호, 거주지역, 반, 비고. 반 이름을 쓰면 없는 반은 자동으로 만들어 배정합니다."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-sm">
              {(["foreigner", "domestic"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => { setImportKind(k); setParsedRows([]); setFileName(""); }}
                  className={`px-4 py-1 rounded ${importKind === k ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                >
                  {KIND_LABEL[k]} 양식
                </button>
              ))}
            </div>
            {/* 양식 다운로드 */}
            <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Download className="h-4 w-4 text-slate-400" />
                <span>양식 파일을 먼저 다운로드하여 작성하세요.</span>
              </div>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => downloadSampleExcel(importKind)}>
                {KIND_LABEL[importKind]} 양식 다운로드
              </Button>
            </div>

            {/* 파일 업로드 영역 */}
            <div
              className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-8 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                <Upload className="h-5 w-5 text-slate-400" />
              </div>
              {fileName ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">{fileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">클릭하여 다른 파일 선택</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">파일을 클릭하여 업로드</p>
                  <p className="text-xs text-muted-foreground mt-0.5">.xlsx, .xls, .csv 지원</p>
                </div>
              )}
            </div>

            {/* 파싱 결과 미리보기 */}
            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">미리보기</p>
                  <div className="flex gap-2 text-xs">
                    {validRows.length > 0 && (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        등록 가능 {validRows.length}명
                      </span>
                    )}
                    {errorRows.length > 0 && (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        오류 {errorRows.length}행
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">이름</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">성별</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">{importKind === "foreigner" ? "국적/비자" : "생년월일"}</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">전화번호</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">지역</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">반</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedRows.map((row, i) => (
                        <tr key={i} className={row.error ? "bg-destructive/5" : ""}>
                          <td className="px-3 py-2 font-medium">{row.name}</td>
                          <td className="px-3 py-2">{row.gender === "male" ? "남" : "여"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{importKind === "foreigner" ? [row.nationality, row.visaType].filter(Boolean).join(" / ") || "-" : row.birthDate || "-"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.phone || "-"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.region || "-"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.className || "-"}</td>
                          <td className="px-3 py-2">
                            {row.error ? (
                              <span className="text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {row.error}
                              </span>
                            ) : (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                정상
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsImportOpen(false); setParsedRows([]); setFileName(""); }}>
              취소
            </Button>
            <Button
              onClick={handleBulkImport}
              disabled={validRows.length === 0 || bulkCreateMutation.isPending}
            >
              {bulkCreateMutation.isPending ? "등록 중..." : `${validRows.length}명 등록`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 등록/수정 다이얼로그 */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) { setIsFormOpen(false); setEditingParticipant(null); }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingParticipant ? "대상자 수정" : "대상자 등록"}</DialogTitle>
            <DialogDescription>
              이름과 성별은 필수 항목입니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>구분</Label>
              <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-sm">
                {(["foreigner", "domestic"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, kind: k }))}
                    className={`px-4 py-1 rounded ${form.kind === k ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>
            {/* 이름 */}
            <div className="space-y-1.5">
              <Label htmlFor="p-name">이름 <span className="text-destructive">*</span></Label>
              <Input
                id="p-name"
                placeholder="이름을 입력하세요"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            {/* 성별 */}
            <div className="space-y-2">
              <Label>성별 <span className="text-destructive">*</span></Label>
              <RadioGroup
                value={form.gender}
                onValueChange={(v) => setForm((f) => ({ ...f, gender: v as "male" | "female" }))}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="male" id="p-male" />
                  <Label htmlFor="p-male" className="cursor-pointer font-normal">
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-medium">남</span>
                      남성
                    </span>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="female" id="p-female" />
                  <Label htmlFor="p-female" className="cursor-pointer font-normal">
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-500 text-xs flex items-center justify-center font-medium">여</span>
                      여성
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {form.kind === "foreigner" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="p-nationality" className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    국적
                  </Label>
                  <Input id="p-nationality" placeholder="예: 베트남, 중국" value={form.nationality} onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="p-birth">생년월일</Label>
                  <Input id="p-birth" type="date" value={form.birthDate} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="p-phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  전화번호
                </Label>
                <Input id="p-phone" placeholder="010-0000-0000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {form.kind === "foreigner" && (
                <div className="space-y-1.5">
                  <Label htmlFor="p-visa" className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                    비자종류
                  </Label>
                  <Input id="p-visa" placeholder="예: F-4, E-9, H-2" value={form.visaType} onChange={(e) => setForm((f) => ({ ...f, visaType: e.target.value }))} />
                </div>
              )}
              <div className={`space-y-1.5 ${form.kind === "domestic" ? "col-span-2" : ""}`}>
                <Label htmlFor="p-region" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {form.kind === "domestic" ? "거주지역(주소)" : "거주지역"}
                </Label>
                <Input id="p-region" placeholder="예: 화성시 향남읍" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} />
              </div>
            </div>
            {form.kind === "foreigner" && (
              <div className="space-y-1.5">
                <Label htmlFor="p-birth2">생년월일</Label>
                <Input id="p-birth2" type="date" value={form.birthDate} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="p-note">비고</Label>
              <Input id="p-note" placeholder="메모 (선택)" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>반 배정 <span className="text-xs font-normal text-muted-foreground">(여러 반 선택 가능)</span></Label>
              {classes.length === 0 ? (
                <p className="text-xs text-muted-foreground">만들어 둔 반이 없습니다. 출석부에서 반을 만들거나, 엑셀의 '반' 열에 이름을 적으면 자동으로 만들어집니다.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {classes.map((c) => {
                    const on = form.classIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, classIds: on ? f.classIds.filter((x) => x !== c.id) : [...f.classIds, c.id] }))}
                        className={`px-2.5 py-1 rounded-full border text-xs ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsFormOpen(false); setEditingParticipant(null); }}>
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending
                ? "저장 중..."
                : editingParticipant ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>대상자를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제된 대상자와 관련된 실적 데이터도 영향을 받을 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deletingId) deleteMutation.mutate({ id: deletingId }); }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold mt-1 ${color}`}>
          {value}<span className="text-sm font-normal ml-0.5">{unit}</span>
        </p>
      </CardContent>
    </Card>
  );
}

// 미사용 아이콘 suppress
void Filter;
