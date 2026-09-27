import { Search, ArrowRight } from "lucide-react";
import { useState } from "react";

export function SearchBar({ onSearch, loading }: { onSearch: (value: string) => void; loading: boolean }) {
  const [value, setValue] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (value.trim()) onSearch(value);
  }

  return (
    <form className="searchbar" onSubmit={submit}>
      <Search size={19} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Analyze github.com/owner/repository"
        aria-label="GitHub repository"
      />
      <button type="submit" disabled={loading}>
        {loading ? "Analyzing…" : "Analyze"}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}