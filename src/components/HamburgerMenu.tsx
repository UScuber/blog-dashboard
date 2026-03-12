import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "../lib/firebase";

interface HamburgerMenuProps {
  email: string;
}

export function HamburgerMenu({ email }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const [prevPathname, setPrevPathname] = useState(location.pathname);

  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="hidden max-md:block relative" ref={ref}>
      <button
        className={`flex flex-col justify-center items-center gap-[5px] w-11 h-11 bg-transparent border-none cursor-pointer p-2.5 ${open ? "hamburger-open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-label="メニュー"
      >
        <span className="block w-[22px] h-0.5 bg-gray-800 rounded-sm transition-all duration-300" />
        <span className="block w-[22px] h-0.5 bg-gray-800 rounded-sm transition-all duration-300" />
        <span className="block w-[22px] h-0.5 bg-gray-800 rounded-sm transition-all duration-300" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-90"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full right-0 z-100 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[200px] py-2">
            <div className="px-4 py-2.5 text-[13px] text-slate-500">
              {email}
            </div>
            <div className="h-px bg-slate-200 my-1" />
            <Link
              to="/"
              className="flex items-center w-full px-4 py-2.5 text-sm text-gray-800 no-underline min-h-11 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              記事一覧
            </Link>
            <Link
              to="/new"
              className="flex items-center w-full px-4 py-2.5 text-sm text-gray-800 no-underline min-h-11 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              新規作成
            </Link>
            <div className="h-px bg-slate-200 my-1" />
            <button
              className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 bg-transparent border-none text-left cursor-pointer min-h-11 hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
            >
              ログアウト
            </button>
          </div>
        </>
      )}
    </div>
  );
}
