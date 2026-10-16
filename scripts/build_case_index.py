#!/usr/bin/env python3
"""공동모금회 배분사례집 PDF -> server/data/caseIndex.json
사용: python3 scripts/build_case_index.py <pdf디렉터리> [출력경로]
- 각 사례의 기획배경/성과목표/세부사업/성과지표 부분을 짧게 발췌해 검색용 색인을 만든다.
- 중복 파일(같은 연도 사례집)은 연도별로 페이지 수가 가장 많은 한 파일만 사용한다.
"""
import json, re, subprocess, sys, hashlib
from pathlib import Path

src = Path(sys.argv[1])
out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "server/data/caseIndex.json"

def pages_of(pdf):
    r = subprocess.run(["pdftotext", str(pdf), "-"], capture_output=True, text=True)
    return r.stdout.split("\f")

def year_of(text):
    m = re.search(r"(20[12]\d)\s*(?:년)?\s*(?:사랑의|사회복지)", text[:3000]) or re.search(r"(20[12]\d)", text[:3000])
    return int(m.group(1)) if m else 0

def squash(s):
    s = re.sub(r"[\x00-\x08\x0b-\x1f]", "", s)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"(?:\b[A-Za-z]\b\s?){4,}", " ", s)  # 세로 URL 조각 제거
    return s.strip()

def cut(s, n):
    s = squash(s)
    return s if len(s) <= n else s[:n].rstrip() + "…"

def between(text, start, ends):
    i = text.find(start)
    if i < 0: return ""
    j = len(text)
    for e in ends:
        k = text.find(e, i + len(start))
        if k >= 0: j = min(j, k)
    return text[i + len(start):j]

books = {}
for pdf in sorted(src.glob("*.pdf")):
    pg = pages_of(pdf)
    full = "\n".join(pg[:6])
    if len("".join(pg)) < 50000:  # 스캔본(텍스트 없음)
        print("skip(no text):", pdf.name); continue
    y = year_of(full)
    if y == 0:
        m = re.search(r"(20[12]\d)", pdf.name); y = int(m.group(1)) if m else 0
    if y not in books or len(pg) > len(books[y][1]):
        books[y] = (pdf.name, pg)

cases = []
for y, (name, pg) in sorted(books.items()):
    starts = [i for i, t in enumerate(pg) if "기획배경" in t and ("핵심 참여자" in t or "성과목표" in t)]
    if len(starts) < 10:  # 구판 서식: 3쪽 단위로 쪼개 검색용 청크 생성
        starts = [i for i, t in enumerate(pg) if re.search(r"(사업\s*개요|사업명|기관\s*소개|사업\s*배경)", t)]
    for n, s in enumerate(starts):
        e = starts[n + 1] if n + 1 < len(starts) else min(len(pg), s + 4)
        block = "\n".join(pg[s:min(e, s + 4)])
        head = block.split("기획배경")[0] if "기획배경" in block else block[:400]
        bg = between(block, "기획배경", ["성과목표", "프로그램 수행현황"])
        goals = between(block, "성과목표", ["프로그램 수행현황", "세부사업명"])
        acts = between(block, "세부사업명", ["사업의 성과", "성과지표", "평가결과"])
        outs = block[block.find("성과지표"):] if "성과지표" in block else ""
        item = {
            "id": hashlib.md5(f"{y}-{s}".encode()).hexdigest()[:10],
            "year": y,
            "page": s + 1,
            "head": cut(head, 260),
            "background": cut(bg, 420),
            "goals": cut(goals, 320),
            "activities": cut(acts, 520),
            "outcomes": cut(outs, 520),
        }
        if len(item["head"]) + len(item["background"]) < 60: continue
        cases.append(item)
    print(y, name, "pages", len(pg), "cases", sum(1 for c in cases if c["year"] == y))

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(cases, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("total", len(cases), "bytes", out.stat().st_size)
