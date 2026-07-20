import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";

export interface B3Option {
  ticker: string;
  strike: number;
  vencimento: string; // dd/MM/yyyy
  tipo: "CALL" | "PUT";
  precoUltimo: number;
  family: string;
}

interface B3OptionsContextValue {
  options: B3Option[];
  families: string[];
  vencimentos: string[];
  loading: boolean;
  ensureLoaded: () => void;
  getByFamily: (family: string) => B3Option[];
  getByTicker: (ticker: string) => B3Option | undefined;
  getStrikeAndExpiry: (ticker: string) => { strike: number; vencimento: string; tipo: "CALL" | "PUT" } | null;
}

const B3OptionsContext = createContext<B3OptionsContextValue | null>(null);

export function B3OptionsProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<B3Option[]>([]);
  const [families, setFamilies] = useState<string[]>([]);
  const [vencimentos, setVencimentos] = useState<string[]>([]);
  // idle até uma feature de opções realmente montar (evita baixar 7 MB em toda sessão)
  const [loading, setLoading] = useState(false);
  const [optionMap, setOptionMap] = useState<Map<string, B3Option>>(new Map());
  const [familyMap, setFamilyMap] = useState<Map<string, B3Option[]>>(new Map());
  const startedRef = useRef(false);

  // Carrega o catálogo de opções sob demanda, uma única vez.
  const ensureLoaded = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setLoading(true);

    fetch("/opcoes.json")
      .then((r) => r.json())
      .then((data: Array<{ t: string; s: number; v: string; tp: string; p: number; f: string }>) => {
        const parsed: B3Option[] = data.map((d) => ({
          ticker: d.t,
          strike: d.s,
          vencimento: d.v,
          tipo: d.tp === "C" ? "CALL" : "PUT",
          precoUltimo: d.p,
          family: d.f,
        }));

        const fMap = new Map<string, B3Option[]>();
        const tMap = new Map<string, B3Option>();
        const vSet = new Set<string>();

        for (const opt of parsed) {
          tMap.set(opt.ticker, opt);
          if (opt.family) {
            const arr = fMap.get(opt.family);
            if (arr) arr.push(opt);
            else fMap.set(opt.family, [opt]);
          }
          vSet.add(opt.vencimento);
        }

        setOptions(parsed);
        setOptionMap(tMap);
        setFamilyMap(fMap);
        setFamilies(Array.from(fMap.keys()).sort());
        setVencimentos(
          Array.from(vSet).sort((a, b) => {
            const [da, ma, ya] = a.split("/").map(Number);
            const [db, mb, yb] = b.split("/").map(Number);
            return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
          })
        );
        setLoading(false);
      })
      .catch(() => {
        // permite nova tentativa numa próxima montagem
        startedRef.current = false;
        setLoading(false);
      });
  }, []);

  const getByFamily = useCallback((family: string) => familyMap.get(family) || [], [familyMap]);
  const getByTicker = useCallback((ticker: string) => optionMap.get(ticker), [optionMap]);
  const getStrikeAndExpiry = useCallback(
    (ticker: string) => {
      const opt = optionMap.get(ticker.toUpperCase());
      if (!opt) return null;
      return { strike: opt.strike, vencimento: opt.vencimento, tipo: opt.tipo };
    },
    [optionMap]
  );

  return (
    <B3OptionsContext.Provider value={{ options, families, vencimentos, loading, ensureLoaded, getByFamily, getByTicker, getStrikeAndExpiry }}>
      {children}
    </B3OptionsContext.Provider>
  );
}

export function useB3Options(): B3OptionsContextValue {
  const ctx = useContext(B3OptionsContext);
  if (!ctx) throw new Error("useB3Options must be used within B3OptionsProvider");
  // Dispara o carregamento do catálogo assim que a primeira feature de opções o consome.
  useEffect(() => {
    ctx.ensureLoaded();
  }, [ctx]);
  return ctx;
}
