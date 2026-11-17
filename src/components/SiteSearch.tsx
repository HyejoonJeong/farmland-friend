import { useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, ArrowUpRight, Search, X } from "lucide-react";
import { SITE_MENUS } from "@/lib/site-navigation";

export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const normalized = query.trim().toLocaleLowerCase().replace(/\s+/g, "");
  const matches = SITE_MENUS.filter((menu) =>
    `${menu.title}${menu.keywords}`.toLocaleLowerCase().replace(/\s+/g, "").includes(normalized),
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="site-search-toggle" aria-label="메뉴 검색 열기">
          <Search size={26} aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="app-modal-overlay" />
        <Dialog.Content
          className="site-search-modal"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div className="modal-heading">
            <Dialog.Title>어떤 메뉴를 찾으세요?</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="modal-close" aria-label="메뉴 검색 닫기">
                <X size={24} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="modal-description">
            궁금한 내용을 입력하면 관련 메뉴를 찾아드려요.
          </Dialog.Description>
          <label htmlFor={inputId} className="sr-only">
            메뉴 검색어
          </label>
          <div className="site-search-input">
            <Search size={22} aria-hidden="true" />
            <input
              id={inputId}
              type="search"
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="예: 농지연금, 의견, 전수조사"
              maxLength={100}
              autoComplete="off"
            />
          </div>
          <p className="site-search-count" role="status">
            {normalized ? `${matches.length}개의 메뉴를 찾았어요.` : "전체 메뉴"}
          </p>
          <ul className="site-search-results">
            {matches.map((menu) => (
              <li key={menu.title}>
                {"to" in menu ? (
                  <Link to={menu.to} onClick={() => setOpen(false)}>
                    {menu.title}
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                ) : (
                  <a
                    href={menu.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                  >
                    {menu.title}
                    <ArrowUpRight size={18} aria-hidden="true" />
                    <span className="sr-only">(새 창)</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
          {matches.length === 0 && (
            <p className="site-search-empty">
              일치하는 메뉴가 없어요.
              <br />
              다른 단어로 검색해 주세요.
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
