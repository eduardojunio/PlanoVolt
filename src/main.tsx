import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  HashRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-600.css';
import '@fontsource/noto-sans/latin-700.css';
import './styles.css';
import {
  checkLabels,
  ENGINE_VERSION,
  invalidateConfirmations,
  selectAlternative,
  newPlan,
  statusLabels,
  type Alternative,
  type Check,
  type CheckKey,
  type Plan,
} from './domain/model';
import { decimal, evaluatePlan, type PlanEvaluation } from './domain/engine';
import { methodLabels, ruleset } from './domain/rules';
import { repository } from './storage/plans';
import { snapshotPlan } from './domain/snapshot';

const fmt = (n: number | undefined, digits = 2) =>
  n === undefined
    ? '—'
    : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(n);
const altName = (id: Alternative, method: string) =>
  id === 'shared'
    ? 'Eletroduto compartilhado'
    : method === 'C'
      ? 'Cabo independente sobre parede'
      : 'Eletroduto independente';
type AppContext = {
  plan: Plan | null;
  evaluation: PlanEvaluation | null;
  change: (fn: (p: Plan) => void, technical?: boolean) => void;
  open: (p: Plan) => Promise<boolean>;
  save: () => Promise<boolean>;
  saved: string;
  revision: number;
  remove: (id: string) => Promise<void>;
  error: string;
  setError: (s: string) => void;
};
const Context = createContext<AppContext>(null!);
const usePlan = () => useContext(Context);
function Bolt() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24">
      <path d="m14 2-9 12h6l-1 8 9-12h-6z" fill="currentColor" />
    </svg>
  );
}
function App() {
  const [plan, setPlan] = useState<Plan | null>(null),
    [saved, setSaved] = useState(''),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  const [online, setOnline] = useState(navigator.onLine),
    [offlineReady, setOfflineReady] = useState(false),
    [worker, setWorker] = useState<ServiceWorkerRegistration | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    generation = useRef(0),
    current = useRef(plan);
  current.current = plan;
  const evaluation = useMemo(() => (plan ? evaluatePlan(plan, ruleset) : null), [plan]);
  async function persist(p: Plan, token: number) {
    try {
      await repository.save(p);
      setRevision((r) => r + 1);
      if (token === generation.current) {
        setSaved('Salvo neste dispositivo');
        setError('');
      }
      return true;
    } catch {
      if (token === generation.current) {
        setSaved('Não salvo');
        setError(
          'Não foi possível salvar no dispositivo. Mantenha esta página aberta, tente salvar novamente ou exporte o PDF.',
        );
      }
      return false;
    }
  }
  useEffect(() => {
    clearTimeout(timer.current);
    if (plan) {
      setSaved('Alterações pendentes');
      const token = ++generation.current;
      timer.current = setTimeout(() => {
        setSaved('Salvando…');
        void persist(plan, token);
      }, 400);
    }
    return () => clearTimeout(timer.current);
  }, [plan]);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          setWorker(reg);
          const track = () => {
            const installing = reg.installing;
            installing?.addEventListener('statechange', () => {
              if (installing.state === 'redundant')
                setError(
                  'O cache offline não pôde ser concluído. Reabra o aplicativo com conexão antes de trabalhar offline.',
                );
              if (reg.waiting)
                setWorker({ ...reg, waiting: reg.waiting } as ServiceWorkerRegistration);
            });
          };
          reg.addEventListener('updatefound', track);
          track();
          return navigator.serviceWorker.ready;
        })
        .then(() => setOfflineReady(true))
        .catch(() =>
          setError(
            'O cache offline não ficou disponível. Reabra com conexão antes de trabalhar offline.',
          ),
        );
      const changed = () => {
        if (sessionStorage.getItem('planovolt-update')) {
          sessionStorage.removeItem('planovolt-update');
          location.reload();
        }
      };
      navigator.serviceWorker.addEventListener('controllerchange', changed);
      return () => {
        window.removeEventListener('online', on);
        window.removeEventListener('offline', on);
        navigator.serviceWorker.removeEventListener('controllerchange', changed);
      };
    }
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);
  const change = (fn: (p: Plan) => void, technical = false) =>
    setPlan((previous) => {
      if (!previous) return previous;
      const next = structuredClone(previous);
      fn(next);
      const result = technical ? invalidateConfirmations(next) : next;
      result.updatedAt = new Date().toISOString();
      return result;
    });
  const save = async () => {
    clearTimeout(timer.current);
    if (!current.current) return true;
    setSaved('Salvando…');
    const ok = await persist(current.current, ++generation.current);
    if (ok) setSaved('Salvamento confirmado neste dispositivo');
    return ok;
  };
  const remove = async (id: string) => {
    if (current.current?.id === id) {
      clearTimeout(timer.current);
      generation.current++;
    }
    await repository.delete(id);
    if (current.current?.id === id) setPlan(null);
    setRevision((r) => r + 1);
  };
  return (
    <Context.Provider
      value={{
        plan,
        evaluation,
        change,
        open: async (p) => {
          if (current.current?.id === p.id) return true;
          if (current.current && !(await save())) return false;
          setError('');
          setPlan(p);
          return true;
        },
        save,
        saved,
        revision,
        remove,
        error,
        setError,
      }}
    >
      <header className="app-header">
        <Link to="/" className="brand" aria-label="PlanoVolt início">
          <span className="brand-symbol">
            <Bolt />
          </span>
          Plano<span>Volt</span>
        </Link>
        <span className="connection">
          <i className={online ? 'online' : ''} />
          {online ? (offlineReady ? 'Disponível offline' : 'Neste dispositivo') : 'Sem conexão'}
        </span>
      </header>
      <aside aria-label="Revisão técnica do motor" className="review-banner">
        <span aria-hidden="true">◈</span> Versão de desenvolvimento · motor aguardando validação
        profissional
      </aside>
      <main>
        {error && (
          <div className="notice danger" role="alert">
            {error}
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home update={worker?.waiting ?? null} />} />
          <Route path="/plan/:id/:step" element={<Editor />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <span>PlanoVolt · planejamento com critério</span>
        <span>Motor {ENGINE_VERSION} · dados locais, sem conta</span>
      </footer>
    </Context.Provider>
  );
}
function Home({ update }: { update: ServiceWorker | null }) {
  const { open, revision, remove, setError, save } = usePlan(),
    navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]),
    [loading, setLoading] = useState(true),
    [deleteId, setDeleteId] = useState<string | null>(null);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!deleteId) return;
    const previous = document.activeElement as HTMLElement | null;
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDeleteId(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const buttons = dialog.current?.querySelectorAll('button');
      if (!buttons?.length) return;
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [deleteId]);
  useEffect(() => {
    let active = true;
    repository
      .list()
      .then((p) => {
        if (active) {
          setPlans(p);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(
            'Não foi possível ler os planos locais. Verifique o armazenamento do navegador. Registros incompatíveis são preservados.',
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [revision, setError]);
  const create = async () => {
    const p = newPlan(ruleset.version);
    if (await open(p)) navigate(`/plan/${p.id}/equipment`);
  };
  return (
    <div className="home">
      <div className="eyebrow">SEU ASSISTENTE DE CAMPO</div>
      <section className="hero">
        <div>
          <h1>
            Do equipamento
            <br />
            ao plano de circuito.
          </h1>
          <p>
            Dimensione, confira os pontos de atenção e organize os materiais da próxima instalação.
          </p>
          <button className="primary" onClick={create}>
            <span aria-hidden="true">＋</span> Nova instalação
          </button>
          <div className="hero-foot">Cobre · PVC 70 °C · cargas resistivas · 127 e 220 V</div>
        </div>
        <div className="circuit-art" aria-hidden="true">
          <span className="art-label">CIRCUITO DEDICADO</span>
          <div className="panel-art">
            <div />
            <div />
            <div />
            <div />
            <b>QDC</b>
          </div>
          <div className="wire-art">
            <i />
            <i />
            <i />
          </div>
          <div className="load-art">
            <Bolt />
          </div>
          <span className="art-caption">Medir. Dimensionar. Verificar.</span>
        </div>
      </section>
      {update && (
        <div className="notice">
          <strong>Uma atualização está pronta.</strong>
          <p>Salve seu trabalho e atualize entre sessões de edição.</p>
          <button
            onClick={async () => {
              if (await save()) {
                sessionStorage.setItem('planovolt-update', '1');
                update.postMessage('ACTIVATE');
              }
            }}
          >
            Atualizar aplicativo
          </button>
        </div>
      )}
      <section className="saved-section">
        <div className="section-heading">
          <div>
            <h2>Suas instalações</h2>
            <p>Continue de onde parou, neste dispositivo.</p>
          </div>
          <span className="count">{plans.length}</span>
        </div>
        {loading ? (
          <p role="status">Carregando planos locais…</p>
        ) : plans.length ? (
          <div className="plan-list">
            {plans.map((p) => {
              const e = evaluatePlan(p, ruleset);
              return (
                <article className="plan-card" key={p.id}>
                  <span className="plan-icon">
                    <Bolt />
                  </span>
                  <div>
                    <Link
                      className="plan-title"
                      to={`/plan/${p.id}/results`}
                      onClick={async (event) => {
                        event.preventDefault();
                        if (await open(p)) navigate(`/plan/${p.id}/results`);
                      }}
                    >
                      {p.name || 'Instalação sem nome'}
                    </Link>
                    <p>
                      {p.equipment.voltage ? p.equipment.voltage + ' V' : 'Tensão a definir'} ·{' '}
                      {new Date(p.updatedAt).toLocaleDateString('pt-BR')}
                    </p>
                    <span className={`badge ${e.status}`}>{statusLabels[e.status]}</span>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Excluir ${p.name || 'instalação sem nome'}`}
                    onClick={() => setDeleteId(p.id)}
                  >
                    Excluir
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">
              ▧
            </span>
            <h3>Seu primeiro plano começa aqui</h3>
            <p>
              Crie uma instalação para organizar cálculos,
              <br />
              verificações e materiais em um só lugar.
            </p>
            <button className="text-button" onClick={create}>
              Criar meu primeiro plano <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </section>
      <aside className="privacy">
        <span aria-hidden="true">◎</span>
        <div>
          <strong>Seu trabalho fica com você.</strong>
          <p>
            Os planos ficam no armazenamento deste navegador. Limpar os dados, usar modo privado ou
            perder o dispositivo pode apagar os registros. Exporte os PDFs para guardar uma cópia.
            Nenhum dado da instalação é enviado a servidores.
          </p>
        </div>
      </aside>
      {deleteId && (
        <div className="modal-backdrop">
          <section
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="modal"
          >
            <h2 id="delete-title">Excluir instalação?</h2>
            <p>O plano será removido deste dispositivo. Esta ação não pode ser desfeita.</p>
            <div className="button-row">
              <button autoFocus onClick={() => setDeleteId(null)}>
                Cancelar
              </button>
              <button
                className="destructive"
                onClick={async () => {
                  try {
                    await remove(deleteId);
                    setDeleteId(null);
                  } catch {
                    setError('Não foi possível excluir o plano.');
                  }
                }}
              >
                Confirmar exclusão
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
const steps = [
  ['equipment', 'Equipamento'],
  ['route', 'Trajeto'],
  ['safety', 'Quadro e segurança'],
  ['results', 'Resultados'],
] as const;
function Editor() {
  const { id, step } = useParams(),
    { plan, evaluation, open, saved, save, setError } = usePlan();
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true;
    if (id && plan?.id !== id) {
      repository
        .load(id)
        .then((p) => {
          if (active) {
            if (p) open(p);
            else setLoadError('Instalação não encontrada neste dispositivo.');
          }
        })
        .catch(() => {
          if (active)
            setLoadError(
              'Não foi possível abrir o registro. Dados incompatíveis foram preservados.',
            );
        });
    }
    return () => {
      active = false;
    };
  }, [id, plan?.id]);
  if (loadError)
    return (
      <div className="notice danger" role="alert">
        {loadError} <Link to="/">Voltar ao início</Link>
      </div>
    );
  if (!plan || plan.id !== id || !evaluation) return <p role="status">Abrindo plano…</p>;
  const index = steps.findIndex(([key]) => key === step);
  if (index < 0) return <Navigate to={`/plan/${id}/equipment`} replace />;
  return (
    <div className="editor">
      <div className="editor-top">
        <Link to="/" className="back-link">
          ← Instalações
        </Link>
        <span className="save-status" role="status">
          {saved}
        </span>
      </div>
      <nav aria-label="Etapas do plano" className="step-nav">
        {steps.map(([key, label], i) => (
          <Link
            aria-current={key === step ? 'step' : undefined}
            className={key === step ? 'active' : ''}
            to={`/plan/${id}/${key}`}
            key={key}
          >
            <span>{i + 1}</span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="editor-layout">
        <div className="editor-main">
          {step === 'equipment' ? (
            <Equipment />
          ) : step === 'route' ? (
            <RouteForm />
          ) : step === 'safety' ? (
            <Safety />
          ) : (
            <Results />
          )}
          <div className="form-actions">
            {index > 0 ? (
              <Link className="button" to={`/plan/${id}/${steps[index - 1][0]}`}>
                ← Voltar
              </Link>
            ) : (
              <Link to="/" className="button">
                Voltar ao início
              </Link>
            )}
            {index < 3 ? (
              <Link className="button primary" to={`/plan/${id}/${steps[index + 1][0]}`}>
                {index === 2 ? 'Ver resultados' : 'Continuar'} →
              </Link>
            ) : (
              <button onClick={() => void save().catch(() => setError('Falha ao salvar.'))}>
                Salvar plano
              </button>
            )}
          </div>
        </div>
        <aside className="live-summary">
          <div className="eyebrow">SEU CIRCUITO</div>
          <h3>{plan.name || 'Nova instalação'}</h3>
          <div className="current-number">
            {fmt(evaluation.current)} <span>A</span>
          </div>
          <p>{evaluation.currentSource || 'Informe os dados para calcular a corrente.'}</p>
          <dl>
            <div>
              <dt>Tensão</dt>
              <dd>{plan.equipment.voltage || '—'} V</dd>
            </div>
            <div>
              <dt>Comprimento</dt>
              <dd>{plan.route.length || '—'} m</dd>
            </div>
            <div>
              <dt>Método</dt>
              <dd>{plan.route.method || '—'}</dd>
            </div>
          </dl>
          <span className={`badge ${evaluation.status}`}>{statusLabels[evaluation.status]}</span>
          <hr />
          <p className="small">
            Um cálculo é parte do plano. As condições reais da instalação precisam ser verificadas
            por profissional responsável.
          </p>
        </aside>
      </div>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  unit,
  hint,
  error,
  required = false,
  minimum,
  maximum,
  integer = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  minimum?: number;
  maximum?: number;
  integer?: boolean;
}) {
  const id = React.useId(),
    number = decimal(value);
  const invalid =
    value !== '' &&
    (number === undefined ||
      (required && number === 0) ||
      (minimum !== undefined && number < minimum) ||
      (maximum !== undefined && number > maximum) ||
      (integer && !Number.isInteger(number)));
  const feedback =
    error ||
    (number === undefined
      ? 'Informe um número válido, usando vírgula para decimais.'
      : required && number === 0
        ? 'Informe um valor maior que zero.'
        : minimum !== undefined && maximum !== undefined
          ? `Informe ${integer ? 'um número inteiro' : 'um valor'} entre ${minimum} e ${maximum}.`
          : minimum !== undefined
            ? `Informe um valor maior ou igual a ${minimum}.`
            : `Informe um valor de até ${maximum}.`);
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {unit && <span className="unit">{unit}</span>}
      </label>
      <input
        id={id}
        value={value}
        inputMode="decimal"
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-hint`}
      />
      <small id={`${id}-hint`} className={invalid ? 'field-error' : ''}>
        {invalid ? feedback : hint}
      </small>
    </div>
  );
}
function Select({
  label,
  value,
  onChange,
  children,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = React.useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
      >
        {children}
      </select>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
function Confirm({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="confirmation">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
function PageTitle({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div className="eyebrow">{number}</div>
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
function Equipment() {
  const { plan: p, change } = usePlan();
  if (!p) return null;
  const eq = (key: keyof Plan['equipment'], value: string | boolean) =>
    change((n) => {
      Object.assign(n.equipment, { [key]: value });
      if (['current', 'kind', 'voltage'].includes(key)) n.equipment.nameplateConfirmed = false;
    }, true);
  return (
    <>
      <PageTitle number="01 / EQUIPAMENTO" title="O que vamos instalar?">
        Comece pelos dados de placa e pelas condições de alimentação.
      </PageTitle>
      <section className="form-card">
        <h2>Identificação e carga</h2>
        <div className="field">
          <label htmlFor="plan-name">Nome da instalação</label>
          <input
            id="plan-name"
            placeholder="Ex.: Forno da cozinha"
            value={p.name}
            onChange={(e) =>
              change((n) => {
                n.name = e.target.value;
              })
            }
          />
        </div>
        <Select label="Equipamento" value={p.equipment.kind} onChange={(v) => eq('kind', v)}>
          <option value="oven">Forno elétrico</option>
          <option value="shower">Chuveiro elétrico</option>
          <option value="heater">Aquecimento resistivo</option>
          <option value="other">Outra carga resistiva</option>
          <option value="unsupported">Motor / inversor / carga não suportada</option>
        </Select>
        <div className="field-grid">
          <Field
            label="Potência nominal"
            unit="W"
            value={p.equipment.power}
            onChange={(v) => eq('power', v)}
            required
            hint="Da placa ou do manual. Ex.: 3500"
          />
          <Field
            label="Corrente nominal"
            unit="A"
            value={p.equipment.current}
            onChange={(v) => eq('current', v)}
            required
            hint="Se confirmada na placa, tem prioridade."
          />
        </div>
        {p.equipment.current && (
          <Confirm
            checked={p.equipment.nameplateConfirmed}
            onChange={(v) => eq('nameplateConfirmed', v)}
          >
            Corrente conferida na placa do equipamento.
          </Confirm>
        )}
        {p.equipment.power && p.equipment.current && (
          <div className="notice">
            Potência e corrente informadas: registre a verificação de consistência na etapa de
            segurança. O motor não inventa uma tolerância de placa.
          </div>
        )}
        <div className="field-grid">
          <Select
            label="Tensão nominal"
            value={p.equipment.voltage}
            onChange={(v) => eq('voltage', v)}
          >
            <option value="">Selecionar tensão</option>
            <option value="127">127 V</option>
            <option value="220">220 V</option>
          </Select>
          <Select label="Alimentação" value={p.equipment.supply} onChange={(v) => eq('supply', v)}>
            <option value="">Selecionar alimentação</option>
            <option value="LN">Fase-neutro</option>
            <option value="LL">Fase-fase</option>
          </Select>
        </div>
        <Select
          label="Conexão do equipamento"
          value={p.equipment.connection}
          onChange={(v) => eq('connection', v)}
        >
          <option value="">Não verificada</option>
          <option value="Tomada">Tomada (especificação a verificar)</option>
          <option value="Ligação direta">Ligação direta (terminais a verificar)</option>
        </Select>
        <Confirm checked={p.equipment.resistive} onChange={(v) => eq('resistive', v)}>
          Confirmei que a carga é puramente resistiva (FP = 1), compatível com este cálculo.
        </Confirm>
      </section>
      <div className="notice subtle">
        Atendemos circuitos dedicados de 127 e 220 V. Motores, inversores, ar-condicionado e
        circuitos trifásicos exigem outro dimensionamento.
      </div>
    </>
  );
}
function RouteForm() {
  const { plan: p, change } = usePlan();
  if (!p) return null;
  const route = (key: keyof Plan['route'], v: string | boolean) =>
    change((n) => {
      Object.assign(n.route, { [key]: v });
      if (key === 'method') n.route.arrangementConfirmed = false;
      if (['method', 'sharedCircuits', 'temperature'].includes(key))
        n.route.sharedGroupConfirmed = false;
    }, true);
  return (
    <>
      <PageTitle number="02 / TRAJETO" title="Como será o percurso?">
        As condições de instalação determinam quanto o cabo pode conduzir.
      </PageTitle>
      <section className="form-card">
        <h2>Trajeto e condições</h2>
        <Field
          label="Distância do quadro ao equipamento"
          unit="m"
          value={p.route.length}
          onChange={(v) => route('length', v)}
          required
          hint="Comprimento de ida. O cálculo considera ida e retorno."
        />
        <Select
          label="Método de instalação"
          value={p.route.method}
          onChange={(v) => route('method', v)}
        >
          <option value="">Selecionar arranjo real</option>
          {Object.entries(methodLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
          <option value="unsupported">Outro método / parede isolante / enterrado</option>
        </Select>
        <div className="material-strip">
          Cu <span>Cobre</span>
          <i />
          70 °C <span>PVC</span>
          <i />2 <span>condutores carregados</span>
        </div>
        <Confirm
          checked={p.route.arrangementConfirmed}
          onChange={(v) => route('arrangementConfirmed', v)}
        >
          O trajeto corresponde ao arranjo de referência selecionado, sem parede termicamente
          isolante, sol / infravermelho, conduto ferromagnético ou condutores em paralelo. PE no
          mesmo eletroduto ou cabo. Para a alternativa independente, considerei percurso
          termicamente separado de outros circuitos.
        </Confirm>
        <div className="field-grid">
          <Select
            label="Temperatura ambiente"
            value={p.route.temperature}
            onChange={(v) => route('temperature', v)}
            hint="Não adote 30 °C sem verificar o ambiente."
          >
            <option value="">Não verificada</option>
            {Object.keys(ruleset.temperature).map((t) => (
              <option key={t} value={t}>
                {t} °C
              </option>
            ))}
          </Select>
          <Select
            label="Seção máxima disponível"
            value={p.route.maxSection}
            onChange={(v) => route('maxSection', v)}
            hint="Opcional: limite real da solução a avaliar."
          >
            <option value="">Avaliar catálogo até 35 mm²</option>
            {ruleset.sections.map((s) => (
              <option key={s} value={s}>
                {fmt(s)} mm²
              </option>
            ))}
          </Select>
        </div>
      </section>
      <section className="form-card">
        <h2>Alternativas do percurso</h2>
        <p className="muted">
          Cada alternativa tem sua própria verificação de viabilidade. Eletroduto próprio não
          garante ausência de agrupamento: a alternativa independente exige separação térmica de
          outros circuitos. A comparação não confirma a ocupação do eletroduto.
        </p>
        <Select
          label="Alternativa selecionada"
          value={p.selectedAlternative}
          onChange={(v) =>
            change((n) => {
              Object.assign(n, selectAlternative(n, v as Alternative));
            })
          }
        >
          <option value="independent">{altName('independent', p.route.method)}</option>
          <option value="shared">
            Eletroduto compartilhado{p.route.method === 'C' ? ' (não suportado em C)' : ''}
          </option>
        </Select>
        {p.route.method !== 'C' ? (
          <>
            <Field
              label="Total de circuitos no eletroduto compartilhado"
              minimum={2}
              maximum={8}
              integer
              value={p.route.sharedCircuits}
              onChange={(v) => route('sharedCircuits', v)}
              hint="Inclua o circuito novo. Cobertura: 2 a 8 circuitos."
            />
            <Confirm
              checked={p.route.sharedGroupConfirmed}
              onChange={(v) => route('sharedGroupConfirmed', v)}
            >
              Conferi grupo homogêneo em feixe, uniformemente carregado, com mesma temperatura de
              isolação (tabela 42, linha 1).
            </Confirm>
          </>
        ) : (
          <div className="notice">
            Método C: somente um cabo multipolar independente fixado sobre parede. Não há
            alternativa em eletroduto compartilhado.
          </div>
        )}
        {(['independent', 'shared'] as const)
          .filter((id) => id === 'independent' || p.route.method !== 'C')
          .map((id) => (
            <CheckEditor
              key={id}
              label={`Viabilidade: ${altName(id, p.route.method)}`}
              value={p.route.feasibility[id]}
              onChange={(value) =>
                change((n) => {
                  n.route.feasibility[id] = value;
                })
              }
            />
          ))}
      </section>
    </>
  );
}
function CheckEditor({
  label,
  value,
  onChange,
  allowNA = false,
}: {
  label: string;
  value: Check;
  onChange: (c: Check) => void;
  allowNA?: boolean;
}) {
  const id = React.useId();
  return (
    <fieldset className={`check-editor ${value.state}`}>
      <legend>{label}</legend>
      <div className="check-grid">
        <Select
          label="Resultado da verificação"
          value={value.state}
          onChange={(v) => onChange({ ...value, state: v as Check['state'] })}
        >
          <option value="pending">Pendente</option>
          <option value="passed">Conferido</option>
          <option value="failed">Falhou / incompatível</option>
          {allowNA && <option value="not-applicable">Não se aplica (justificar)</option>}
        </Select>
        <Select
          label="Tipo de evidência"
          value={value.evidence}
          onChange={(v) => onChange({ ...value, evidence: v as Check['evidence'] })}
        >
          <option value="professional">Confirmação profissional</option>
          <option value="measured">Medição</option>
          <option value="calculated">Cálculo externo</option>
        </Select>
      </div>
      <label htmlFor={id}>Evidência / justificativa</label>
      <textarea
        id={id}
        rows={2}
        value={value.note}
        onChange={(e) => onChange({ ...value, note: e.target.value })}
        placeholder="Registre valor, documento, condição verificada e responsável."
        aria-invalid={(value.state !== 'pending' && !value.note.trim()) || undefined}
      />
      {value.state !== 'pending' && !value.note.trim() && (
        <small className="field-error">Registre evidência para concluir esta verificação.</small>
      )}
    </fieldset>
  );
}
function Safety() {
  const { plan: p, change } = usePlan();
  if (!p) return null;
  const safety = (key: keyof Plan['safety'], v: string | boolean) =>
    change((n) => {
      Object.assign(n.safety, { [key]: v });
    }, true);
  return (
    <>
      <PageTitle number="03 / QUADRO E SEGURANÇA" title="O cálculo encontra a instalação.">
        Registre o que foi verificado em campo. Uma falha bloqueia o plano; uma dúvida permanece
        visível.
      </PageTitle>
      <section className="form-card">
        <h2>Dados da instalação</h2>
        <Field
          label="Disjuntor geral (informativo)"
          unit="A"
          value={p.safety.mainBreaker}
          onChange={(v) => safety('mainBreaker', v)}
          required
          hint="Este valor não comprova a capacidade da alimentação."
        />
        <div className="field-grid">
          <Field
            label="Queda de tensão a montante"
            unit="%"
            value={p.safety.upstreamDrop}
            onChange={(v) => safety('upstreamDrop', v)}
            hint="Medição ou cálculo externo até o quadro."
          />
          <Select
            label="Limite total aplicável à origem"
            value={p.safety.totalLimit}
            onChange={(v) => safety('totalLimit', v)}
            hint="Verificar origem e condições de 6.2.7.1."
          >
            <option value="">A verificar</option>
            <option value="5">5% · ponto de entrega em BT (caso c)</option>
            <option value="7">7% · transformador / gerador (casos a, b, d)</option>
          </Select>
        </div>
        <Field
          label="Relação I2/In do disjuntor"
          minimum={1}
          value={p.safety.i2Ratio}
          onChange={(v) => safety('i2Ratio', v)}
          hint="Do fabricante. Sem esse dado, coordenação de sobrecarga permanece pendente."
        />
        <Confirm
          checked={p.safety.overloadTimeConfirmed}
          onChange={(v) => safety('overloadTimeConfirmed', v)}
        >
          Verifiquei a nota de 5.3.4.1: a temperatura limite de sobrecarga não será mantida por mais
          de 100 h em 12 meses consecutivos, nem por mais de 500 h na vida do condutor. Posso
          aplicar I2 ≤ 1,45 Iz. Sem confirmação, aplica-se I2 ≤ Iz.
        </Confirm>
        <div className="notice subtle">
          Altere os dados técnicos antes de concluir as verificações. Mudanças de equipamento,
          trajeto ou parâmetros invalidam confirmações positivas dependentes. Falhas registradas são
          preservadas.
        </div>
      </section>
      <section className="form-card">
        <h2>Verificações do profissional</h2>
        <p className="muted">
          “Conferido” exige evidência. Somente a aplicabilidade do DR aceita “Não se aplica”, com
          justificativa.
        </p>
        {(Object.keys(checkLabels) as CheckKey[])
          .filter((k) => k !== 'nameplate' || !!(p.equipment.power && p.equipment.current))
          .map((key) => (
            <CheckEditor
              key={key}
              label={checkLabels[key]}
              value={p.safety.checks[key]}
              allowNA={key === 'rcd'}
              onChange={(c) =>
                change((n) => {
                  n.safety.checks[key] = c;
                })
              }
            />
          ))}
      </section>
    </>
  );
}
function Results() {
  const { plan: p, evaluation: e, change, setError } = usePlan();
  const [exporting, setExporting] = useState(false);
  if (!p || !e) return null;
  const selected = e.alternatives[e.selected],
    r = selected.result;
  const exportPDF = async () => {
    const snapshot = snapshotPlan(p, e);
    setExporting(true);
    try {
      const { createPDF } = await import('./pdf');
      const pdf = await createPDF(snapshot);
      pdf.save(`PlanoVolt-${p.id.slice(0, 8)}.pdf`);
    } catch {
      setError(
        'Não foi possível gerar o PDF local. Verifique se o carregamento inicial e o cache das fontes foram concluídos.',
      );
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <PageTitle number="04 / RESULTADOS" title="Seu plano de circuito">
        Resultados rastreáveis para preparar a próxima etapa do trabalho.
      </PageTitle>
      <section className={`result-status ${e.status}`}>
        <div>
          <span className={`badge ${e.status}`}>{statusLabels[e.status]}</span>
          <h2>{p.name || 'Instalação sem nome'}</h2>
          <p>
            {p.equipment.voltage || '—'} V · {fmt(e.current)} A · {p.route.length || '—'} m ·{' '}
            {p.route.method || 'Método a definir'}
          </p>
        </div>
        <button onClick={() => void exportPDF()} disabled={exporting}>
          {exporting ? 'Gerando…' : 'Exportar PDF'} <span aria-hidden="true">↗</span>
        </button>
      </section>
      <div className="result-edit-links">
        <Link to={`/plan/${p.id}/equipment`}>Editar equipamento</Link>
        <Link to={`/plan/${p.id}/route`}>Editar trajeto</Link>
        <Link to={`/plan/${p.id}/safety`}>Revisar segurança</Link>
      </div>
      <section className="form-card">
        <div className="section-heading">
          <h2>Dimensionamento {e.status === 'blocked' ? 'bloqueado' : 'do circuito'}</h2>
          <span className="small">{altName(e.selected, p.route.method)}</span>
        </div>
        {r ? (
          <>
            <div className="metrics">
              <div>
                <span>Condutores ativos</span>
                <strong>
                  {fmt(r.section)} <small>mm²</small>
                </strong>
              </div>
              <div>
                <span>Proteção PE</span>
                <strong>
                  {fmt(r.pe)} <small>mm²</small>
                </strong>
              </div>
              <div>
                <span>Disjuntor candidato</span>
                <strong>
                  {r.breaker} <small>A · {r.poles}P</small>
                </strong>
              </div>
            </div>
            <dl className="result-details">
              <div>
                <dt>Capacidade de referência</dt>
                <dd>{fmt(r.ampacity)} A</dd>
              </div>
              <div>
                <dt>Fatores temperatura × agrupamento</dt>
                <dd>
                  {fmt(r.temperatureFactor)} × {fmt(r.groupingFactor)}
                </dd>
              </div>
              <div>
                <dt>Capacidade corrigida (Iz)</dt>
                <dd>{fmt(r.correctedAmpacity)} A</dd>
              </div>
              <div>
                <dt>Queda do trecho (máx. 4%)</dt>
                <dd>
                  {fmt(r.dropV)} V · {fmt(r.dropPercent)}%
                </dd>
              </div>
              <div>
                <dt>Queda total da instalação</dt>
                <dd>
                  {r.totalDrop === undefined ? 'A verificar' : fmt(r.totalDrop) + '%'}
                  {p.safety.totalLimit ? ' / limite ' + p.safety.totalLimit + '%' : ''}
                </dd>
              </div>
            </dl>
            <p className="criterion">
              <strong>Critério determinante:</strong> {r.governing}
            </p>
            <details>
              <summary>Por que não usar uma seção menor?</summary>
              {selected.candidates.filter((c) => c.failures.length).length ? (
                selected.candidates
                  .filter((c) => c.failures.length)
                  .map((c) => (
                    <p key={c.section}>
                      {fmt(c.section)} mm²: {c.failures.join('; ')}.
                    </p>
                  ))
              ) : (
                <p>A primeira seção avaliada é a mínima de 2,5 mm² para este circuito de força.</p>
              )}
            </details>
          </>
        ) : (
          <div className="notice">
            Sem dimensionamento para esta alternativa. Complete os dados ou resolva as condições
            fora da cobertura abaixo.
          </div>
        )}
        <div className="notice subtle">
          Curva, capacidade de interrupção, especificação do DR e conexão:{' '}
          <strong>A definir</strong>. A indicação de corrente nominal é um candidato sujeito às
          verificações.
        </div>
      </section>
      <section className="form-card">
        <h2>Compare os percursos</h2>
        <div className="alternative-grid">
          {Object.values(e.alternatives).map((a) => (
            <button
              className={`alternative ${e.selected === a.id ? 'selected' : ''}`}
              key={a.id}
              onClick={() =>
                change((n) => {
                  Object.assign(n, selectAlternative(n, a.id));
                })
              }
              aria-pressed={e.selected === a.id}
            >
              <span className="eyebrow">{e.selected === a.id ? 'SELECIONADO' : 'ALTERNATIVA'}</span>
              <strong>{altName(a.id, p.route.method)}</strong>
              <span>
                {a.result
                  ? `${fmt(a.result.section)} mm² · ${a.result.breaker} A`
                  : 'Dados insuficientes / fora da cobertura'}
              </span>
              <span className={`badge ${a.status}`}>{statusLabels[a.status]}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="form-card">
        <div className="section-heading">
          <h2>Pontos de atenção</h2>
          <span className="count">{e.issues.length}</span>
        </div>
        {e.issues.length ? (
          <ol className="issue-list">
            {[...e.blockers, ...e.inputErrors, ...e.openItems].map((i, index) => (
              <li key={`${i.code}-${index}`} className={i.severity}>
                <span>
                  {i.severity === 'blocker'
                    ? 'BLOQUEIO'
                    : i.severity === 'error'
                      ? 'DADO NECESSÁRIO'
                      : 'VERIFICAR'}
                </span>
                {i.message}
              </li>
            ))}
          </ol>
        ) : (
          <p>
            Todos os critérios cobertos e verificações obrigatórias foram atendidos. A execução e os
            ensaios finais seguem sob responsabilidade profissional.
          </p>
        )}
      </section>
      <section className="form-card">
        <h2>Materiais preliminares</h2>
        <Field
          label="Reserva de comprimento"
          minimum={0}
          maximum={100}
          unit="%"
          value={p.allowance}
          onChange={(v) =>
            change((n) => {
              n.allowance = v;
            })
          }
          hint="Inicialmente 0%. Quantidade base e reserva são exibidas separadamente."
        />
        {selected.materials.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Material / especificação</th>
                  <th>Base</th>
                  <th>Reserva</th>
                </tr>
              </thead>
              <tbody>
                {selected.materials.map((m) => (
                  <tr key={m.item}>
                    <td>
                      <strong>{m.item}</strong>
                      <small>{m.specification}</small>
                    </td>
                    <td>{m.quantity === null ? 'A definir' : fmt(m.quantity) + ' ' + m.unit}</td>
                    <td>{m.allowance === null ? '—' : fmt(m.allowance) + ' ' + m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">A definir após dimensionamento desta alternativa.</p>
        )}
      </section>
      <section className="form-card">
        <details>
          <summary>Critérios e hipóteses aplicados</summary>
          <ul>
            {[...e.criteria, ...e.assumptions].map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>
        <div className="versions">
          <p>{ruleset.source}</p>
          <p>
            Motor {e.engineVersion} · regras {e.rulesetVersion}
          </p>
          <p>
            ID {p.id} · esquema {p.schemaVersion}
          </p>
          <p>
            Motor aguardando validação profissional. Este plano não constitui laudo ou certificação
            de conformidade.
          </p>
        </div>
      </section>
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
