import { jsPDF } from 'jspdf';
import { checkLabels, statusLabels, type CheckKey } from './domain/model';
import { methodLabels } from './domain/rules';
import type { ExportSnapshot } from './domain/snapshot';
const fmt = (n: number | undefined) =>
  n === undefined
    ? 'A definir'
    : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(n);
const evidenceLabels = {
  professional: 'Confirmação profissional',
  measured: 'Medição',
  calculated: 'Cálculo externo',
};
const stateLabels = {
  pending: 'Pendente',
  passed: 'Conferido',
  failed: 'Falhou',
  'not-applicable': 'Não se aplica',
};
export async function createPDF(snapshot: ExportSnapshot): Promise<jsPDF> {
  const response = await fetch('/fonts/NotoSans-Regular.ttf');
  if (!response.ok) throw new Error('Fonte local indisponível.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  let font = '';
  for (let i = 0; i < bytes.length; i += 8192)
    font += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.addFileToVFS('NotoSans.ttf', btoa(font));
  pdf.addFont('NotoSans.ttf', 'NotoSans', 'normal');
  pdf.setFont('NotoSans');
  const { plan: p, evaluation: e } = snapshot,
    selected = e.alternatives[e.selected];
  let y = 24;
  const line = (text: string, heading = false) => {
    if (heading && y > 255) {
      pdf.addPage();
      y = 24;
    }
    pdf.setFontSize(heading ? 13 : 9);
    const lines = pdf.splitTextToSize(
      text
        .replace(/[\u2011\u2013\u2014]/g, '-')
        .replaceAll('≤', '<=')
        .replaceAll('≥', '>='),
      174,
    ) as string[];
    for (const row of lines) {
      if (y > 275) {
        pdf.addPage();
        y = 24;
      }
      pdf.setTextColor(heading ? 17 : 45, heading ? 60 : 52, heading ? 54 : 50);
      pdf.text(row, 18, y);
      y += heading ? 7 : 4.8;
    }
    y += heading ? 2 : 1.2;
  };
  line('PlanoVolt | Plano de circuito', true);
  line(
    e.engineReview === 'pending'
      ? 'DESENVOLVIMENTO - MOTOR AGUARDANDO VALIDAÇÃO PROFISSIONAL'
      : 'Motor com revisão técnica registrada',
  );
  line(
    'Resumo de planejamento. Não constitui laudo, certificação ou aprovação integral da instalação.',
  );
  line(p.name || 'Instalação sem nome', true);
  line(`ID: ${p.id} | Criado: ${p.createdAt} | Editado: ${p.updatedAt}`);
  line(`Exportado: ${snapshot.exportedAt} | Esquema: ${p.schemaVersion}`);
  line(
    `Estado: ${statusLabels[e.status]} | Alternativa: ${e.selected === 'shared' ? 'Eletroduto compartilhado' : p.route.method === 'C' ? 'Cabo independente sobre parede' : 'Eletroduto independente'}`,
  );
  line('Equipamento e trajeto', true);
  const equipmentNames: Record<string, string> = {
    oven: 'Forno elétrico',
    shower: 'Chuveiro elétrico',
    heater: 'Aquecimento resistivo',
    other: 'Outra carga resistiva',
  };
  line(
    `${equipmentNames[p.equipment.kind] ?? p.equipment.kind} | Potência: ${p.equipment.power || 'A definir'} W | Corrente de placa: ${p.equipment.current || 'A definir'} A | Placa confirmada: ${p.equipment.nameplateConfirmed ? 'Sim' : 'Não'}`,
  );
  line(
    `Tensão: ${p.equipment.voltage || 'A definir'} V | Alimentação: ${p.equipment.supply === 'LN' ? 'Fase-neutro' : p.equipment.supply === 'LL' ? 'Fase-fase' : 'A definir'} | Resistiva: ${p.equipment.resistive ? 'Confirmada' : 'Pendente'} | Conexão: ${p.equipment.connection || 'A definir'}`,
  );
  line(`Corrente de projeto: ${fmt(e.current)} A | Origem: ${e.currentSource ?? 'A definir'}`);
  line(
    `Comprimento de ida: ${p.route.length || 'A definir'} m | ${methodLabels[p.route.method] ?? 'Método a definir'} | Temperatura: ${p.route.temperature || 'A definir'} °C`,
  );
  line(
    `Arranjo confirmado: ${p.route.arrangementConfirmed ? 'Sim' : 'Não'} | Seção máxima: ${p.route.maxSection || 'Não limitada pelo usuário'} mm² | Circuitos compartilhados: ${p.route.sharedCircuits || 'A definir'} | Grupo homogêneo confirmado: ${p.route.sharedGroupConfirmed ? 'Sim' : 'Não'}`,
  );
  line(
    `Disjuntor geral (informativo): ${p.safety.mainBreaker || 'A definir'} A | Queda a montante: ${p.safety.upstreamDrop || 'A definir'}% | Limite total: ${p.safety.totalLimit || 'A definir'}%`,
  );
  line(
    `I2/In: ${p.safety.i2Ratio || 'A definir'} | Condição temporal de 5.3.4.1 confirmada: ${p.safety.overloadTimeConfirmed ? 'Sim' : 'Não (limite conservador I2 ≤ Iz)'}`,
  );
  for (const alt of Object.values(e.alternatives)) {
    line(
      `${alt.id === 'shared' ? 'Alternativa compartilhada' : 'Alternativa independente'} - ${statusLabels[alt.status]}`,
      true,
    );
    if (alt.result) {
      const r = alt.result;
      line(
        `Ativos: ${fmt(r.section)} mm² | PE: ${fmt(r.pe)} mm² | Disjuntor candidato: ${r.breaker} A, ${r.poles} polo(s)`,
      );
      line(
        `Iz referência: ${fmt(r.ampacity)} A | Fator temperatura: ${fmt(r.temperatureFactor)} | Fator agrupamento: ${fmt(r.groupingFactor)} | Iz corrigida: ${fmt(r.correctedAmpacity)} A`,
      );
      line(
        `Queda do trecho: ${fmt(r.dropV)} V / ${fmt(r.dropPercent)}% | Queda total: ${fmt(r.totalDrop)}% | Critério determinante: ${r.governing}`,
      );
    } else line('Sem recomendação numérica: dados insuficientes ou alternativa fora da cobertura.');
    for (const c of alt.candidates.filter((c) => c.failures.length))
      line(`Candidato ${c.section} mm² rejeitado: ${c.failures.join('; ')}`);
    for (const issue of alt.issues)
      line(
        `${issue.severity === 'blocker' ? 'BLOQUEIO' : issue.severity === 'error' ? 'DADO NECESSÁRIO' : 'PENDÊNCIA'} [${issue.code}]: ${issue.message}`,
      );
  }
  line('Verificações registradas', true);
  for (const key of Object.keys(checkLabels) as CheckKey[]) {
    const c = p.safety.checks[key];
    line(
      `${checkLabels[key]}: ${stateLabels[c.state]} | ${evidenceLabels[c.evidence]} | ${c.note || 'Sem evidência registrada'}`,
    );
  }
  for (const [id, c] of Object.entries(p.route.feasibility))
    line(
      `Viabilidade ${id === 'shared' ? 'compartilhada' : 'independente'}: ${stateLabels[c.state]} | ${evidenceLabels[c.evidence]} | ${c.note || 'Sem evidência registrada'}`,
    );
  line(`Materiais da alternativa selecionada | Reserva: ${p.allowance}%`, true);
  if (!selected.materials.length) line('A definir: dimensionamento incompleto.');
  for (const m of selected.materials)
    line(
      `${m.item}: ${m.quantity === null ? 'A definir' : fmt(m.quantity) + ' ' + m.unit} | Reserva adicional: ${m.allowance === null ? 'A definir' : fmt(m.allowance) + ' ' + m.unit} | ${m.specification}`,
    );
  line('Critérios, hipóteses e limitações', true);
  [...e.criteria, ...e.assumptions].forEach((t) => line(t));
  line(
    `Motor ${e.engineVersion} | Regras ${e.rulesetVersion} | Revisão do motor: ${e.engineReview === 'pending' ? 'Pendente' : 'Revisado'}`,
  );
  line(
    e.rulesetSource +
      '; tabelas 36, 40, 42, 47, 58; 5.3.4.1; 6.2.7. Modelo suplementar: Prysmian, guia de dimensionamento rev.10, 6.2 e tabelas 29/31.',
  );
  line(
    'Curva do disjuntor, capacidade de interrupção, especificação do DR e componentes de conexão: A definir. Validar com fabricante e profissional responsável.',
  );
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(90);
    pdf.text(`PlanoVolt | ${p.id.slice(0, 8)} | ${page} / ${pages}`, 18, 289);
  }
  return pdf;
}
