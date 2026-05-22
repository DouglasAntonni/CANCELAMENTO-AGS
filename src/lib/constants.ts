export const SUPERVISORES = [
  "Luciene Soares Batista (Samurai)",
  "Amanda Santos",
  "Guilherme Fernando C. dos Santos",
  "Alexsandra Gonçalves Cardoso",
  "Crisleny Maria Claudino dos Santos",
  "Amanda Dornelas",
  "Assuério Rocha",
  "João Gonzaga",
  "Pedro Henrique Silva",
  "Josimar Soares Jr",
  "Gleybson Silva Caldas",
  "Raynne Carolayne da Silva",
  "Thiago Lucio",
  "Kamila Emanuele",
  "Taciana Supervisão",
  "Savio Rafael",
  "Google Ads",
  "Parceiros",
];

export const OPERADORAS = ["Vivo", "Claro", "TIM", "Oi", "Algar", "Sky", "Net", "Outra"];

export const FORMAS_PAGAMENTO = [
  "Boleto",
  "Débito automático",
  "Cartão de crédito",
  "Pix",
  "Outro",
];

export function maskCPF(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCNPJ(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a && a.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""),
    );
  return d.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
}

export function maskMoney(v: string) {
  const n = v.replace(/\D/g, "");
  if (!n) return "";
  return (Number(n) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function parseMoney(v: string) {
  const n = v.replace(/\D/g, "");
  return n ? Number(n) / 100 : null;
}
