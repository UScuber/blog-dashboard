import { useState, useEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut } from "./lib/firebase";
import { LoginPage } from "./components/LoginPage";
import { ArticleList } from "./components/ArticleList";
import { ArticleEditor } from "./components/ArticleEditor";
import { HamburgerMenu } from "./components/HamburgerMenu";
import { Button } from "./components/ui/button";
import { LoadingScreen } from "./components/LoadingScreen";
import { Toast } from "./components/Toast";

function AppLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  if (!authChecked) {
    return <LoadingScreen message="読み込み中..." />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <>
      <Header email={user.email || ""} />
      <main className="px-8 py-6 max-w-[1200px] mx-auto max-md:p-4">
        <Outlet />
      </main>
      <Toast />
    </>
  );
}

function Header({ email }: { email: string }) {
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between px-8 h-14 bg-white border-b border-slate-200 sticky top-0 z-100 max-md:h-12 max-md:px-4">
      <Link
        to="/"
        className="text-lg font-bold text-gray-800 no-underline max-md:text-base"
      >
        記事管理ダッシュボード
      </Link>
      <nav className="flex items-center gap-4 max-md:hidden">
        <Link
          to="/"
          className="text-sm text-slate-500 no-underline transition-colors hover:text-blue-600"
        >
          記事一覧
        </Link>
        <Button size="sm" onClick={() => navigate("/new")}>
          新規作成
        </Button>
        <span className="text-[13px] text-slate-500">{email}</span>
        <Button variant="secondary" size="sm" onClick={() => signOut()}>
          ログアウト
        </Button>
      </nav>
      <HamburgerMenu email={email} />
    </header>
  );
}

function ArticleEditorWrapper() {
  const { id } = useParams<{ id: string }>();
  return <ArticleEditor key={id} />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <ArticleList /> },
      { path: "new", element: <ArticleEditor key="new" /> },
      { path: "edit/:id", element: <ArticleEditorWrapper /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
