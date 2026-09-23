import './globals.css';
import Link from 'next/link';
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: 'Regioncup Skidskytte',
  description: 'Cupställning och tävlingsresultat för svenskt skidskytte',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>
        <header>
          <div className="wrap header-inner">
            <Link className="brand" href="/">Regioncup Skidskytte</Link>
            <nav aria-label="Huvudmeny">
              <Link href="/">Ställning</Link>
              <Link href="/akare">Sök åkare</Link>
              <Link href="/regler">Cupregler</Link>\n              <Link href="/nollklubben">Nollklubben</Link>
              <Link href="/admin">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer><div className="wrap">Regional cupadministration för skidskytte · <Link href="/kontakt">Upptäckt ett fel eller har ett förbättringsförslag?</Link></div></footer>
        <Analytics />
      </body>
    </html>
  );
}
