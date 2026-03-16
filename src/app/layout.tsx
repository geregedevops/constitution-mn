import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const font = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Үндсэн Хууль AI",
  description: "Монгол Улсын Үндсэн хуулийн AI чатбот",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn">
      <body className={`${font.className} antialiased min-h-screen`}>
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border h-16">
          <div className="container mx-auto flex h-full items-center px-6 max-w-[1200px]">
            <div className="flex items-center gap-3">
              <div className="w-[38px] h-[38px] rounded-xl bg-primary flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-[17px] font-bold tracking-tight">Үндсэн Хууль AI</span>
            </div>
          </div>
        </header>
        <main>{children}</main>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "white",
              border: "1px solid #E2E8F0",
              color: "#0F172A",
              borderRadius: "12px",
            },
          }}
        />
      </body>
    </html>
  );
}
