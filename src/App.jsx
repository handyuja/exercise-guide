import React, { useEffect, useMemo, useState } from "react";

// ✅ 단일 파일 React 앱 (+ 공유 링크 동기화)
// - 로컬스토리지 저장/로드
// - 운동법 추가/편집/삭제
// - 검색, 정렬, 복사, JSON 내보내기/가져오기
// - Tailwind UI 사용 (CDN 또는 빌드 설정 중 하나)
// - 모달 하단 버튼 sticky 처리 (저장/닫기 항상 보임)
// - 공유 링크: 현재 목록을 URL에 담아 복사/불러오기

const STORAGE_KEY = "exerciseListV1";

// --- 공유 링크 유틸 ---
function encodeData(obj) {
  const json = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(json))); // UTF-8 safe base64
}
function decodeData(b64) {
  const json = decodeURIComponent(escape(atob(b64)));
  return JSON.parse(json);
}
function getQueryParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}
function setQueryParam(key, val) {
  const url = new URL(window.location.href);
  if (val == null) url.searchParams.delete(key);
  else url.searchParams.set(key, val);
  window.history.replaceState({}, "", url.toString());
}

function uid() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveData(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs leading-5">
      {children}
    </span>
  );
}

function Field({ label, children, required }) {
  return (
    <label className="block mb-3">
      <div className="mb-1 text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </div>
      {children}
    </label>
  );
}

function Modal({ open, onClose, children, title, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-[92vw] max-w-xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            className="rounded-full p-2 hover:bg-gray-100"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="max-h-[70vh] overflow-auto pr-1">{children}</div>

        {/* 항상 보이는 하단 고정 버튼 바 */}
        {footer && (
          <div className="sticky bottom-0 -mx-5 mt-4 border-t bg-white px-5 pt-3 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState(() => loadData());
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("updatedAt");
  const [selectedId, setSelectedId] = useState(null);

  // 폼 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [caution, setCaution] = useState("");
  const [link, setLink] = useState("");
  const [tagsText, setTagsText] = useState("");

  useEffect(() => saveData(items), [items]);

  // ✨ 페이지에 ?data= 가 있으면 불러오기 안내
  useEffect(() => {
    const q = getQueryParam("data");
    if (!q) return;
    try {
      const incoming = decodeData(q);
      if (!Array.isArray(incoming)) return;
      if (confirm("공유 링크에서 데이터를 불러올까요? (현재 목록을 덮어씁니다)")) {
        setItems(incoming);
      }
    } catch (e) {
      console.warn("링크 데이터 파싱 실패", e);
    } finally {
      // 한 번 처리 후 주소 정리
      setQueryParam("data", null);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter((it) => {
          const hay = `${it.title}\n${it.content || ""}\n${it.caution || ""}\n${
            (it.tags || []).join(" ")
          }`.toLowerCase();
          return hay.includes(q);
        })
      : items;

    const sorted = [...base].sort((a, b) => {
      if (sortKey === "title") return a.title.localeCompare(b.title, "ko");
      return (b[sortKey] || 0) - (a[sortKey] || 0);
    });

    return sorted;
  }, [items, query, sortKey]);

  const selected = useMemo(
    () => items.find((it) => it.id === selectedId) || null,
    [items, selectedId]
  );

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setContent("");
    setCaution("");
    setLink("");
    setTagsText("");
  }

  function openAdd() {
    resetForm();
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setTitle(item.title || "");
    setContent(item.content || "");
    setCaution(item.caution || "");
    setLink(item.link || "");
    setTagsText((item.tags || []).join(", "));
    setModalOpen(true);
  }

  function handleSave() {
    const t = title.trim();
    if (!t) {
      alert("제목은 필수입니다.");
      return;
    }

    const now = Date.now();
    const tags = tagsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingId) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === editingId
            ? { ...it, title: t, content, caution, link, tags, updatedAt: now }
            : it
        )
      );
      setSelectedId(editingId);
    } else {
      const id = uid();
      const item = {
        id,
        title: t,
        content,
        caution,
        link,
        tags,
        createdAt: now,
        updatedAt: now,
      };
      setItems((prev) => [item, ...prev]);
      setSelectedId(id);
    }

    setModalOpen(false);
  }

  function handleDelete(item) {
    if (!confirm(`정말 삭제하시겠어요?\n[${item.title}]`)) return;
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    if (selectedId === item.id) setSelectedId(null);
  }

  const [toasts, setToasts] = useState([]);
  function toast(msg) {
    const id = uid();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2000);
  }

  function copyToClipboard(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast("클립보드에 복사되었습니다."))
      .catch(() => alert("복사 실패. 브라우저 권한을 확인하세요."));
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exercise-list-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error("형식 오류");
        const safe = data
          .filter((d) => d && d.id && d.title)
          .map((d) => ({
            id: d.id || uid(),
            title: String(d.title || "무제"),
            content: String(d.content || ""),
            caution: String(d.caution || ""),
            link: String(d.link || ""),
            tags: Array.isArray(d.tags) ? d.tags.map(String) : [],
            createdAt: Number(d.createdAt) || Date.now(),
            updatedAt: Number(d.updatedAt) || Date.now(),
          }));
        setItems(safe);
        toast("가져오기 완료");
      } catch (e) {
        alert("가져오기 실패: 유효한 JSON 파일이 아닙니다.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-white">
              🏥
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">운동법 리스트</h1>
              <p className="text-xs text-gray-500">치료 후 자가운동 가이드 관리</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* ✨ 공유 링크 기능 */}
            <button
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => {
                try {
                  const b64 = encodeData(items);
                  const url = `${location.origin}${location.pathname}?data=${b64}`;
                  navigator.clipboard
                    .writeText(url)
                    .then(() =>
                      alert(
                        "공유 링크를 클립보드에 복사했습니다.\n다른 기기에서 이 링크를 열면 불러올 수 있어요."
                      )
                    )
                    .catch(() => prompt("복사 실패. 아래 주소를 직접 복사하세요:", url));
                } catch {
                  alert("링크 만들기에 실패했어요.");
                }
              }}
            >
              공유 링크 만들기
            </button>

            <button
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => {
                const raw = prompt("공유 링크(URL)를 붙여넣으세요:");
                if (!raw) return;
                try {
                  const u = new URL(raw);
                  const d = u.searchParams.get("data");
                  if (!d) {
                    alert("유효한 공유 링크가 아니에요.");
                    return;
                  }
                  const incoming = decodeData(d);
                  if (!Array.isArray(incoming)) {
                    alert("데이터 형식이 올바르지 않아요.");
                    return;
                  }
                  if (confirm("이 링크의 데이터로 현재 목록을 덮어쓸까요?")) {
                    setItems(incoming);
                  }
                } catch {
                  alert("링크를 읽는 중 오류가 났어요.");
                }
              }}
            >
              링크에서 불러오기
            </button>

            {/* 기존: 내보내기/가져오기/새 운동법 */}
            <button
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={exportJSON}
            >
              내보내기
            </button>
            <label className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
              가져오기
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])}
              />
            </label>
            <button
              onClick={openAdd}
              className="hidden rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white hover:brightness-110 md:block"
            >
              + 새 운동법
            </button>
          </div>
        </div>
      </header>

      {/* 컨텐츠 */}
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[360px,1fr]">
        {/* 좌측: 리스트 & 검색 */}
        <section className="rounded-2xl border bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <input
              type="text"
              placeholder="검색 (제목/내용/태그)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            />
          </div>
          <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
            <div>
              총 <b>{filtered.length}</b>건
            </div>
            <div className="flex items-center gap-2">
              <span>정렬:</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="rounded-md border px-2 py-1"
              >
                <option value="updatedAt">최근 수정</option>
                <option value="createdAt">최근 추가</option>
                <option value="title">제목</option>
              </select>
            </div>
          </div>

          <ul className="-mx-2 max-h-[60vh] overflow-auto pr-1 md:max-h-[72vh]">
            {filtered.map((it) => (
              <li key={it.id} className="px-2">
                <button
                  onClick={() => setSelectedId(it.id)}
                  className={`group mb-2 w-full rounded-xl border p-3 text-left hover:bg-gray-50 ${
                    selectedId === it.id ? "border-gray-900 bg-gray-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="line-clamp-1 text-sm font-semibold">{it.title}</h3>
                    <div className="text-[10px] text-gray-400">
                      {new Date(it.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {!!(it.tags && it.tags.length) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {it.tags.map((t) => (
                        <Badge key={t}>#{t}</Badge>
                      ))}
                    </div>
                  )}
                  {!!it.content && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600">{it.content}</p>
                  )}
                </button>
              </li>
            ))}

            {filtered.length === 0 && (
              <li className="px-2 py-8 text-center text-sm text-gray-500">
                등록된 항목이 없습니다. 우측 하단 "+" 버튼으로 추가하세요.
              </li>
            )}
          </ul>
        </section>

        {/* 우측: 상세 */}
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          {!selected ? (
            <div className="flex h-[40vh] flex-col items-center justify-center gap-2 text-center text-gray-500 md:h-full">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">📄</div>
              <p className="text-sm">왼쪽에서 항목을 선택하거나 새로 추가하세요.</p>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                    onClick={() => copyToClipboard(buildShareText(selected))}
                  >
                    복사하기
                  </button>
                  <button
                    className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                    onClick={() => openEdit(selected)}
                  >
                    편집
                  </button>
                  <button
                    className="rounded-lg border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(selected)}
                  >
                    삭제
                  </button>
                </div>
              </div>

              <DetailCard item={selected} />
            </div>
          )}
        </section>
      </main>

      {/* 플로팅 + 버튼 (모바일) */}
      <button
        onClick={openAdd}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-3xl leading-none text-white shadow-xl hover:brightness-110 md:hidden"
        aria-label="새 운동법 추가"
      >
        +
      </button>

      {/* 토스트 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 mx-auto flex max-w-md flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto rounded-xl border bg-white px-3 py-2 text-sm shadow">
            {t.msg}
          </div>
        ))}
      </div>

      {/* 추가/편집 모달 */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "운동법 편집" : "새 운동법 추가"}
        footer={
          <>
            <button
              className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
              onClick={() => setModalOpen(false)}
            >
              닫기
            </button>
            <button
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:brightness-110"
              onClick={handleSave}
            >
              저장
            </button>
          </>
        }
      >
        <Field label="제목" required>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예) 어깨 회전근개 스트레칭"
            maxLength={80}
          />
        </Field>
        <Field label="운동 설명 (환자 안내 문구)">
          <textarea
            className="w-full min-h-[120px] rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              "예) 벽을 짚고 팔을 90도로 올린 뒤, 호흡을 내쉬며 10초간 유지합니다. 10회 × 3세트."
            }
          />
        </Field>
        <Field label="주의사항">
          <textarea
            className="w-full min-h-[80px] rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            value={caution}
            onChange={(e) => setCaution(e.target.value)}
            placeholder={"예) 통증 심해지면 즉시 중단, 어지러움/저림 발생 시 연락"}
          />
        </Field>
        <Field label="참고 링크 (영상/블로그 등)">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
          />
        </Field>
        <Field label="태그 (쉼표로 구분)">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="어깨, 재활, 스트레칭"
          />
        </Field>
      </Modal>
    </div>
  );
}

function DetailCard({ item }) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border p-4">
        <div className="mb-2 text-xs text-gray-500">
          생성 {new Date(item.createdAt).toLocaleString()} · 수정{" "}
          {new Date(item.updatedAt).toLocaleString()}
        </div>
        {!!(item.tags && item.tags.length) && (
          <div className="mb-2 flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <Badge key={t}>#{t}</Badge>
            ))}
          </div>
        )}
        {item.content ? (
          <div>
            <h3 className="mb-1 text-sm font-semibold">운동 설명</h3>
            <p className="whitespace-pre-line text-sm leading-6 text-gray-800">{item.content}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">설명이 없습니다.</p>
        )}
      </section>

      <section className="rounded-xl border p-4">
        <h3 className="mb-1 text-sm font-semibold">주의사항</h3>
        {item.caution ? (
          <p className="whitespace-pre-line text-sm leading-6 text-gray-800">{item.caution}</p>
        ) : (
          <p className="text-sm text-gray-500">등록된 주의사항이 없습니다.</p>
        )}
      </section>

      <section className="rounded-xl border p-4">
        <h3 className="mb-1 text-sm font-semibold">참고 링크</h3>
        {item.link ? (
          <a
            className="inline-flex items-center text-sm text-blue-600 underline underline-offset-2 hover:opacity-80"
            href={item.link}
            target="_blank"
            rel="noreferrer"
          >
            {item.link}
          </a>
        ) : (
          <p className="text-sm text-gray-500">등록된 링크가 없습니다.</p>
        )}
      </section>

      <section className="rounded-xl border p-4">
        <h3 className="mb-2 text-sm font-semibold">카톡 전송용 미리보기</h3>
        <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-[13px] leading-6">
{buildShareText(item)}
        </pre>
      </section>
    </div>
  );
}

function buildShareText(item) {
  const lines = [];
  lines.push(`📌 ${item.title}`);
  if (item.content) lines.push("\n운동 설명\n" + item.content);
  if (item.caution) lines.push("\n⚠️ 주의사항\n" + item.caution);
  if (item.link) lines.push("\n🔗 참고 링크\n" + item.link);
  if (item.tags && item.tags.length) lines.push("\n#" + item.tags.join(" #"));
  return lines.join("\n");
}
