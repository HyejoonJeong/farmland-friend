import { useState } from "react";
import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { SITE_MENUS } from "@/lib/site-navigation";
import { HUMAN_SUPPORT_PHONE } from "@/lib/data";

const DRAWER_MENUS = SITE_MENUS.filter((menu) => !("to" in menu) || menu.to !== "/ask");

export function SiteNavigation() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="site-menu-toggle" aria-label="전체 메뉴 열기">
          <Menu size={27} aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="app-modal-overlay" />
        <Dialog.Content className="site-menu-drawer">
          <div className="modal-heading">
            <div>
              <p className="modal-eyebrow">말해농</p>
              <Dialog.Title>전체 메뉴</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="modal-close" aria-label="전체 메뉴 닫기">
                <X size={25} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="modal-description">
            필요한 서비스를 선택해 주세요.
          </Dialog.Description>
          <nav className="drawer-links" aria-label="전체 카테고리">
            {DRAWER_MENUS.map((menu) => {
              const content = (
                <>
                  <span>
                    <strong>{menu.title}</strong>
                    <small>{menu.description}</small>
                  </span>
                  {"to" in menu ? (
                    <ArrowRight size={21} aria-hidden="true" />
                  ) : (
                    <ArrowUpRight size={21} aria-hidden="true" />
                  )}
                </>
              );
              return "to" in menu ? (
                <Link
                  key={menu.title}
                  to={menu.to}
                  activeOptions={{ exact: true }}
                  activeProps={{ "aria-current": "page" }}
                  onClick={() => setOpen(false)}
                >
                  {content}
                </Link>
              ) : (
                <a
                  key={menu.title}
                  href={menu.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                >
                  {content}
                  <span className="sr-only">(새 창)</span>
                </a>
              );
            })}
            <Link
              to="/listen"
              activeOptions={{ exact: true }}
              activeProps={{ "aria-current": "page" }}
              onClick={() => setOpen(false)}
            >
              <span>
                <strong>담당자 바로 연결하기</strong>
              </span>
              <ArrowRight size={21} aria-hidden="true" />
            </Link>
            <a href={`tel:${HUMAN_SUPPORT_PHONE}`} onClick={() => setOpen(false)}>
              <span>
                <strong>농지은행 대표 번호 연결하기</strong>
              </span>
              <ArrowRight size={21} aria-hidden="true" />
            </a>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
