'use client';

export default function PrintButton() {
  return (
    <button type="button" className="print-button" onClick={() => window.print()}>
      Skriv ut / Spara PDF
    </button>
  );
}
