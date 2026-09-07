'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AthleteSearch({ initialValue = '' }: { initialValue?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (value === initialValue) return;

    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      const query = value.trim();
      if (query) next.set('q', query);
      else next.delete('q');
      router.replace(`/?${next.toString()}`, { scroll: false });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [value, initialValue, router, searchParams]);

  function clearSearch() {
    setValue('');
    const next = new URLSearchParams(searchParams.toString());
    next.delete('q');
    router.replace(`/?${next.toString()}`, { scroll: false });
  }

  return (
    <section className="athlete-search" aria-label="Sök åkare">
      <div className="athlete-search-field">
        <label htmlFor="athlete-search">Sök åkare</label>
        <input
          id="athlete-search"
          type="search"
          value={value}
          placeholder="Skriv namn på åkare…"
          autoComplete="off"
          onChange={event => setValue(event.target.value)}
        />
      </div>
      {value && <button type="button" className="secondary-dark" onClick={clearSearch}>Rensa</button>}
    </section>
  );
}
