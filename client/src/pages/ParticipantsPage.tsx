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

type ParticipantForm = {
  name: string;
  gender: "male" | "female";
  nationality: string;
  phone: string;
  visaType: string;
  region: string;
};

type ParsedRow = {
  name: string;
  gender: "male" | "female";
  nationality?: string;
  phone?: string;
  visaType?: string;
  region?: string;
  error?: string;
};

const defaultForm: ParticipantForm = {
  name: "",
  gender: "male",
  nationality: "",
  phone: "",
  visaType: "",
  region: "",
};

/** 성별 문자열 → "male" | "female" 변환 */
function parseGender(raw: unknown): "male" | "female" | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (["남", "남성", "male", "m"].includes(s)) return "male";
  if (["여", "여성", "female", "f"].includes(s)) return "female";
  return null;
}

/** 샘플 엑셀 파일 다운로드 */
function downloadSampleExcel() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["이름", "성별", "국적", "전화번호", "비자종류", "거주지역"],
    ["홍길동", "남", "한국", "010-1234-5678", "F-4", "서울"],
    ["김영희", "여", "중국", "010-9876-5432", "E-9", "경기"],
    ["이철수", "남성", "베트남", "", "F-6", "인천"],
    ["박지현", "여성", "필리핀", "010-1111-2222", "H-2", "부산"],
  ]);
  ws["!cols"] = [
    { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "대상자목록");
  XLSX.writeFile(wb, "대상자_등록_양식.xlsx");
}

export default function ParticipantsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId ?? "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: participants = [], isLoading } = trpc.participants.list.useQuery({ projectId });

  // 검색·필터 상태
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
      if (searchName && !p.name.toLowerCase().includes(searchName.toLowerCase())) return false;
      if (filterNationality !== "all" && p.nationality !== filterNationality) return false;
      if (filterVisaType !== "all" && p.visaType !== filterVisaType) return false;
      if (filterRegion !== "all" && p.region !== filterRegion) return false;
      return true;
    });
  }, [participants, searchName, filterNationality, filterVisaType, filterRegion]);

  const isFiltered = searchName || filterNationality !== "all" || filterVisaType !== "all" || filterRegion !== "all";

  const resetFilters = () => {
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
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMutation = trpc.participants.create.useMutation({
    onSuccess: () => {
      utils.participants.list.invalidate();
      setIsFormOpen(false);
      setForm(defaultForm);
      toast.success("대상자가 등록되었습니다.");
    },
    onError: () => toast.error("대상자 등록에 실패했습니다."),
  });

  const updateMutation = trpc.participants.update.useMutation({
    onSuccess: () => {
      utils.participants.list.invalidate();
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
      setIsImportOpen(false);
      setParsedRows([]);
      setFileName("");
      toast.success(`${data.inserted}명의 대상자가 등록되었습니다.`);
    },
    onError: (err) => toast.error(`대량 등록 실패: ${err.message}`),
  });

  const handleOpenCreate = () => {
    setForm(defaultForm);
    setEditingParticipant(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (p: (typeof participants)[0]) => {
    setForm({
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
    const payload = {
      name: form.name.trim(),
      gender: form.gender,
      nationality: form.nationality.trim() || undefined,
      phone: form.phone.trim() || undefined,
      visaType: form.visaType.trim() || undefined,
      region: form.region.trim() || undefined,
    };
    if (editingParticipant) {
      updateMutation.mutate({ id: editingParticipant.id, ...payload });
    } else {
      createMutation.mutate({ projectId, ...payload });
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

        // 헤더 행 감지
        let startRow = 0;
        if (rows.length > 0) {
          const firstRow = rows[0].map((c) => String(c).trim().toLowerCase());
          if (firstRow.some((c) => ["이름", "name"].includes(c))) {
            startRow = 1;
          }
        }

        const parsed: ParsedRow[] = [];
        for (let i = startRow; i < rows.length; i++) {
          const row = rows[i];
          const rawName = String(row[0] ?? "").trim();
          const rawGender = row[1];

          if (!rawName) continue; // 빈 행 스킵

          const gender = parseGender(rawGender);
          if (!gender) {
            parsed.push({ name: rawName, gender: "male", error: `성별 인식 불가: "${rawGender}"` });
          } else {
            parsed.push({
              name: rawName,
              gender,
              nationality: String(row[2] ?? "").trim() || undefined,
              phone: String(row[3] ?? "").trim() || undefined,
              visaType: String(row[4] ?? "").trim() || undefined,
              region: String(row[5] ?? "").trim() || undefined,
            });
          }
        }

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
        name: r.name,
        gender: r.gender,
        nationality: r.nationality,
        phone: r.phone,
        visaType: r.visaType,
        region: r.region,
      })),
    });
  };

  const maleCount = filteredParticipants.filter((p) => p.gender === "male").length;
  const femaleCount = filteredParticipants.filter((p) => p.gender === "female").length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">대상자 관리</h1>
          {project && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {project.projectName} · 대상자는 큰 사업 단위로 관리됩니다
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setParsedRows([]); setFileName(""); setIsImportOpen(true); }}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            엑셀 가져오기
          </Button>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            대상자 등록
          </Button>
        </div>
      </div>

      {/* 검색·필터 영역 */}
      {participants.length > 0 && (
        <div className="space-y-3">
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
                <SelectTrigger className="h-9 w-[130px] text-sm">
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
                <SelectTrigger className="h-9 w-[130px] text-sm">
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
                <SelectTrigger className="h-9 w-[130px] text-sm">
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
              label={isFiltered ? `검색 결과` : "전체"}
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
              <Button size="sm" onClick={handleOpenCreate}>
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground w-10">#</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">이름</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">성별</th>
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
                        <Badge
                          variant="outline"
                          className={`text-xs ${p.gender === "male" ? "border-blue-200 text-blue-600 bg-blue-50" : "border-rose-200 text-rose-500 bg-rose-50"}`}
                        >
                          {p.gender === "male" ? "남" : "여"}
                        </Badge>
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
              이름, 성별(필수), 국적, 전화번호, 비자종류, 거주지역(선택) 순서로 입력하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 양식 다운로드 */}
            <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Download className="h-4 w-4 text-slate-400" />
                <span>양식 파일을 먼저 다운로드하여 작성하세요.</span>
              </div>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={downloadSampleExcel}>
                양식 다운로드
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
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">국적</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">전화번호</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">비자</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">지역</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedRows.map((row, i) => (
                        <tr key={i} className={row.error ? "bg-destructive/5" : ""}>
                          <td className="px-3 py-2 font-medium">{row.name}</td>
                          <td className="px-3 py-2">{row.gender === "male" ? "남" : "여"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.nationality || "-"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.phone || "-"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.visaType || "-"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.region || "-"}</td>
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
          <div className="space-y-4 py-2">
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
            {/* 2열 그리드: 국적 / 전화번호 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-nationality" className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  국적
                </Label>
                <Input
                  id="p-nationality"
                  placeholder="예: 한국, 중국"
                  value={form.nationality}
                  onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  전화번호
                </Label>
                <Input
                  id="p-phone"
                  placeholder="010-0000-0000"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            {/* 2열 그리드: 비자종류 / 거주지역 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-visa" className="flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  비자종류
                </Label>
                <Input
                  id="p-visa"
                  placeholder="예: F-4, E-9, H-2"
                  value={form.visaType}
                  onChange={(e) => setForm((f) => ({ ...f, visaType: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-region" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  거주지역
                </Label>
                <Input
                  id="p-region"
                  placeholder="예: 서울, 경기"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                />
              </div>
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
