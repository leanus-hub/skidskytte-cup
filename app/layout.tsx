import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Regioncup Skidskytte',
  description: 'Cupställning och tävlingsresultat för regionalt skidskytte',
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
              <Link href="/admin">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer><div className="wrap">Regional cupadministration för skidskytte</div></footer>
      </body>
    </html>
  );
}
