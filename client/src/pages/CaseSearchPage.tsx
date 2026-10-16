import { useState } from "react";
import { Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

/** 공동모금회 배분사례집 발췌 검색: 구조·성과지표 설계를 참고하는 용도 */
export default function CaseSearchPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState(ALL);

  const stats = trpc.cases.stats.useQuery();
  const results = trpc.cases.search.useQuery(
    { query, year: year === ALL ? undefined : Number(year), limit: 20 },
    { enabled: query.length > 0 }
  );

  const years = Object.keys(stats.data?.byYear ?? {}).sort().reverse();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">배분사례집 검색</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          사례집에서 비슷한 대상·분야의 <b>성과목표와 성과지표 설계</b>를 참고하세요. 표시되는 내용은 PDF에서
          자동 추출한 발췌이므로 정확한 내용은 원문 쪽수에서 확인하고, 프로그램 내용은 그대로 옮기지 마세요.
          {stats.data && ` (${years.length}개 연도 · ${stats.data.total}건 색인)`}
        </p>

        <form
          className="flex gap-2 mb-6"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(input.trim());
          }}
        >
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="예: 이주배경 청소년 진로, 노인 영양, 사회적 고립" />
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체 연도</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit">
            <Search className="w-4 h-4 mr-1" />
            검색
          </Button>
        </form>

        {results.isFetching && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {query && !results.isFetching && results.data?.length === 0 && (
          <p className="text-center text-muted-foreground py-10">검색 결과가 없습니다. 다른 단어로 시도해 보세요.</p>
        )}

        <div className="space-y-4">
          {results.data?.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{c.year}년 사례집</Badge>
                  <span className="text-xs text-muted-foreground">원문 약 {c.page}쪽</span>
                </div>
                <CardTitle className="text-sm font-medium leading-relaxed">{c.head}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs leading-relaxed">
                {c.goals && (
                  <p>
                    <span className="font-semibold">성과목표 · </span>
                    {c.goals}
                  </p>
                )}
                {c.outcomes && (
                  <p>
                    <span className="font-semibold">성과지표/평가 · </span>
                    {c.outcomes}
                  </p>
                )}
                {c.background && (
                  <p className="text-muted-foreground">
                    <span className="font-semibold">기획배경 · </span>
                    {c.background}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
