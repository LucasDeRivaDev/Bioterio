import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import ITeRatELogo from '../components/ITeRatELogo'
import iterateLogoOriginal  from '../assets/logoiterate.png'
import iterateTextLogo       from '../assets/iterate+slogan.png'
import iterateTextLogoLight  from '../assets/iterate+sloganfondoclaro.png'
import iterateTitleLogo      from '../assets/iterate+logo+slogan.png'
import iterateTitleLogoLight from '../assets/iterate+logo+sloganfondoclaro.png'
import iterateNavLogo        from '../assets/logoiterate.png'
import iterateNavLogoLight   from '../assets/logoiteratefondoclaro.png'
import { Dna, BarChart2, Archive, Calendar, Skull, Printer, GraduationCap, Microscope, FlaskConical, Building2 } from 'lucide-react'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap');
  .landing-root { font-family: 'Inter', sans-serif; background: #050810; color: #c9d4e0; overflow-x: hidden; }
  .landing-root .mono { font-family: 'JetBrains Mono', monospace; }
  .landing-root .glow-green { box-shadow: 0 0 30px rgba(0,230,118,0.15); }
  .landing-root .text-glow-green { text-shadow: 0 0 20px rgba(0,230,118,0.4); }
  .landing-root .grid-bg {
    background-image: linear-gradient(rgba(0,230,118,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,230,118,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
  }
  .landing-root .card { background: rgba(13,21,40,0.8); border: 1px solid rgba(30,51,82,0.8); backdrop-filter: blur(10px); }
  .landing-root .gradient-text {
    background: linear-gradient(135deg, #00e676 0%, #40c4ff 50%, #ce93d8 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
  @keyframes pulse-green { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  .landing-root .float { animation: float 4s ease-in-out infinite; }
  .landing-root .pulse-green { animation: pulse-green 2s ease-in-out infinite; }
  .landing-root .feature-card { transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease; }
  .landing-root .feature-card:hover { transform: translateY(-4px); border-color: rgba(0,230,118,0.3); box-shadow: 0 8px 40px rgba(0,230,118,0.08); }
  .landing-root ::-webkit-scrollbar { width: 6px; }
  .landing-root ::-webkit-scrollbar-track { background: #050810; }
  .landing-root ::-webkit-scrollbar-thumb { background: rgba(30,51,82,0.8); border-radius: 3px; }
  .landing-root a { color: inherit; }

  /* ── RESPONSIVE ────────────────────────────────── */
  @media (max-width: 900px) {
    .landing-nav-links { display: none !important; }
    .landing-hero-grid { grid-template-columns: 1fr !important; }
    .landing-hero-right { display: none !important; }
    .landing-hero-title { font-size: 36px !important; letter-spacing: -0.5px !important; }
    .landing-hero-subtitle { font-size: 16px !important; max-width: 100% !important; }
    .landing-hero-ctas { flex-direction: column !important; }
    .landing-hero-ctas a { text-align: center !important; }
    .landing-hero-stats { gap: 24px !important; flex-wrap: wrap !important; }
    .landing-features-grid { grid-template-columns: 1fr !important; }
    .landing-steps-grid { grid-template-columns: 1fr !important; }
    .landing-steps-line { display: none !important; }
    .landing-para-quien-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .landing-pricing-grid { grid-template-columns: 1fr !important; }
    .landing-form-grid { grid-template-columns: 1fr !important; }
    .landing-section-h2 { font-size: 28px !important; letter-spacing: -0.5px !important; }
    .landing-nav { height: 64px !important; }
    .landing-nav-inner { height: 64px !important; }
    .landing-nav-logo img { height: 36px !important; }
    .landing-nav-logo { padding: 4px 8px !important; border-radius: 10px !important; }
    .landing-nav-spacer { width: 90px !important; }
    .landing-section-pad { padding: 60px 20px !important; }
    .landing-hero-pad { padding: 40px 20px !important; padding-top: 64px !important; }
    .landing-hero-section { padding-top: 64px !important; }
    .landing-pricing-card { padding: 28px !important; }
    .landing-footer-logo { width: min(480px, 100%) !important; }
  }
  @media (max-width: 480px) {
    .landing-hero-title { font-size: 28px !important; letter-spacing: -0.5px !important; }
    .landing-para-quien-grid { grid-template-columns: 1fr !important; }
    .landing-root nav > div { padding: 0 12px !important; }
    .landing-nav { height: 56px !important; }
    .landing-nav-inner { height: 56px !important; }
    .landing-nav-logo img { height: 28px !important; }
    .landing-nav-logo { padding: 3px 7px !important; border-radius: 8px !important; }
    .landing-nav-spacer { width: 72px !important; }
    .landing-hero-section { padding-top: 56px !important; }
    .landing-hero-pad { padding: 32px 16px !important; padding-top: 56px !important; }
    .landing-section-pad { padding: 48px 16px !important; }
    .landing-hero-stats { gap: 16px !important; }
    .landing-pricing-card { padding: 20px !important; }
    .landing-footer-logo { width: 100% !important; max-width: 100% !important; }
    .landing-section-h2 { font-size: 24px !important; }
    .landing-hero-subtitle { font-size: 15px !important; }
    .landing-cta-btn { padding: 12px 20px !important; font-size: 14px !important; }
  }

`

const NavLinkLanding = ({ href, children, tema }) => (
  <a href={href} style={{ color: tema.textSecondary, textDecoration: 'none', fontSize: '14px', padding: '8px 14px', borderRadius: '8px', transition: 'color 0.2s' }}
    onMouseOver={e => e.target.style.color = tema.accent}
    onMouseOut={e => e.target.style.color = tema.textSecondary}>
    {children}
  </a>
)

export default function Landing() {
  const { sesion } = useAuth()
  const { tema, modoBrillo } = useTheme()

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '10px',
    background: tema.bgInput, border: `1px solid ${tema.bgInputBorde}`,
    color: tema.textPrimary, fontSize: '14px', outline: 'none', fontFamily: 'inherit',
  }

  useEffect(() => {
    const prev = document.title
    document.title = 'ITeRatE — Sistema de Gestión de Bioterio'
    return () => { document.title = prev }
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const btn = document.getElementById('submitBtn')
    const msg = document.getElementById('formMsg')
    btn.textContent = 'Enviando...'
    btn.style.opacity = '0.6'
    setTimeout(() => {
      msg.style.display = 'block'
      msg.style.background = 'rgba(0,0,0,0.05)'
      msg.style.border = '1px solid rgba(0,0,0,0.15)'
      msg.style.color = 'inherit'
      msg.textContent = '✓ ¡Mensaje recibido! Te contactamos a la brevedad.'
      btn.style.display = 'none'
    }, 800)
  }

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="landing-root" style={{ background: tema.bgMain, color: tema.textPrimary }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── NAVBAR ── */}
      <nav className="landing-nav" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: modoBrillo ? 'rgba(244,244,239,0.96)' : 'rgba(5,8,16,0.85)', borderBottom: `1px solid ${tema.bgCardBorde}`, backdropFilter: 'blur(20px)', overflow: 'visible' }}>
        {/* Ícono pestaña — centrado en el nav de 96px */}
        <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '24px', zIndex: 102, pointerEvents: 'none', mixBlendMode: modoBrillo ? 'multiply' : 'normal' }}>
          <div className="landing-nav-logo" style={{
            background: 'none',
            border: 'none',
            boxShadow: 'none',
            padding: '6px 10px',
            display: 'inline-flex',
          }}>
            <img src={modoBrillo ? iterateNavLogoLight : iterateNavLogo} alt="ITeRatE" style={{ height: '120px', width: 'auto', display: 'block', filter: modoBrillo ? 'none' : 'drop-shadow(0 0 8px rgba(0,230,118,0.3))' }} />
          </div>
        </div>

        <div className="landing-nav-inner" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '96px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Espaciador para el logo */}
          <div className="landing-nav-spacer" style={{ width: '130px', flexShrink: 0 }} />

          {/* Nav links — se ocultan en mobile */}
          <div className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <NavLinkLanding href="#features" tema={tema}>Funciones</NavLinkLanding>
            <NavLinkLanding href="#como-funciona" tema={tema}>¿Cómo funciona?</NavLinkLanding>
            <NavLinkLanding href="#pricing" tema={tema}>Planes</NavLinkLanding>
            <a href="#contacto"
              style={{ marginLeft: '4px', padding: '9px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textDecoration: 'none', color: tema.accent, background: tema.accentDim, border: `1.5px solid ${tema.accentBorde}`, transition: 'all 0.2s' }}
            >
              Solicitar demo
            </a>
          </div>
          {sesion ? (
            <Link to="/"
              style={{ padding: '9px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textDecoration: 'none', color: tema.accent, background: tema.accentDim, border: `1.5px solid ${tema.accentBorde}`, transition: 'all 0.2s', whiteSpace: 'nowrap' }}
            >
              Bioterio →
            </Link>
          ) : (
            <Link to="/login"
              style={{ padding: '9px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textDecoration: 'none', color: tema.accent, background: tema.accentDim, border: `1.5px solid ${tema.accentBorde}`, transition: 'all 0.2s', whiteSpace: 'nowrap' }}
            >
              Ingresar →
            </Link>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="grid-bg landing-hero-section" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: '96px', position: 'relative', overflow: 'hidden' }}>
        {!modoBrillo && <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(0,230,118,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />}
        {!modoBrillo && <div style={{ position: 'absolute', top: '40%', left: '20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(64,196,255,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />}

        <div className="landing-hero-grid landing-hero-pad" style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '56px', alignItems: 'center' }}>
          {/* Left */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', background: tema.accentDim, border: `1px solid ${tema.accentBorde}`, marginBottom: '24px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: tema.accent, display: 'inline-block' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: tema.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>Software de bioterio</span>
            </div>

            <h1 className="landing-hero-title" style={{ fontSize: '52px', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: '20px', color: tema.textPrimary }}>
              Gestión inteligente<br />
              <span style={modoBrillo ? {} : { background: 'linear-gradient(135deg, #00e676 0%, #40c4ff 50%, #ce93d8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>de tu colonia</span><br />
              de laboratorio
            </h1>

            <p className="landing-hero-subtitle" style={{ fontSize: '18px', lineHeight: 1.7, color: tema.textSecondary, marginBottom: '36px', maxWidth: '480px' }}>
              ITeRatE centraliza el control de tu bioterio: reproductores, camadas, predicciones de parto, stock y reportes — todo en tiempo real, desde cualquier dispositivo.
            </p>

            <div className="landing-hero-ctas" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href="#contacto" style={{ padding: '14px 28px', borderRadius: '12px', fontSize: '15px', fontWeight: 700, textDecoration: 'none', color: modoBrillo ? '#ffffff' : '#050810', background: modoBrillo ? '#111111' : 'linear-gradient(135deg, #00e676, #40c4ff)', boxShadow: modoBrillo ? 'none' : '0 4px 24px rgba(0,230,118,0.3)' }}>
                Solicitar demo gratuito
              </a>
              <a href="#features" style={{ padding: '14px 28px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, textDecoration: 'none', color: tema.textSecondary, background: modoBrillo ? 'transparent' : 'rgba(30,51,82,0.4)', border: `1px solid ${tema.bgCardBorde}` }}>
                Ver funciones →
              </a>
            </div>

            <div className="landing-hero-stats" style={{ display: 'flex', gap: '32px', marginTop: '48px', paddingTop: '32px', borderTop: `1px solid ${tema.bgCardBorde}` }}>
              {[['100%','Digital, sin papel'],['24/7','Acceso desde cualquier lugar'],['∞','Historial de datos']].map(([val, label]) => (
                <div key={label}>
                  <div className="mono" style={{ fontSize: '28px', fontWeight: 700, color: tema.textPrimary }}>{val}</div>
                  <div style={{ fontSize: '12px', color: tema.textMuted, marginTop: '2px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Logo sin fondo — oculto en mobile */}
          <div className="landing-hero-right float" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mixBlendMode: modoBrillo ? 'multiply' : 'normal' }}>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', width: '100%' }}>
              {!modoBrillo && <div style={{ position: 'absolute', inset: '-40px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,230,118,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />}
              <img
                src={modoBrillo ? iterateTitleLogoLight : iterateTitleLogo}
                alt="ITeRatE"
                style={{
                  width: modoBrillo ? '470px' : '520px',
                  maxWidth: '100%',
                  height: 'auto',
                  display: 'block',
                  filter: modoBrillo ? 'none' : 'drop-shadow(0 0 30px rgba(0,230,118,0.25))',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="landing-section-pad" style={{ padding: '100px 24px', background: tema.bgMain }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: '20px', background: tema.accentDim, border: `1px solid ${tema.accentBorde}`, marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: tema.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>Funciones</span>
            </div>
            <h2 className="landing-section-h2" style={{ fontSize: '40px', fontWeight: 800, color: tema.textPrimary, letterSpacing: '-1px', marginBottom: '16px' }}>Todo lo que necesita tu bioterio</h2>
            <p style={{ fontSize: '16px', color: tema.textSecondary, maxWidth: '520px', margin: '0 auto', lineHeight: 1.7 }}>
              Diseñado específicamente para la gestión de colonias de <em style={{ color: tema.textPrimary }}>Mus musculus</em>, con parámetros biológicos incorporados.
            </p>
          </div>

          <div className="landing-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {[
              { icon: <Dna size={22} />,      title:'Motor predictivo reproductivo', desc:'Calcula automáticamente las ventanas de parto, fechas de destete y madurez reproductiva con precisión científica.', foot:'Gestación · Destete · Madurez' },
              { icon: <BarChart2 size={22} />, title:'Scoring de rendimiento', desc:'Evalúa la eficiencia reproductiva de cada macho por latencia de fertilización. Ranking automático con puntajes por apareamiento.', foot:'Score 10 · 7 · 5 pts por latencia' },
              { icon: <Archive size={22} />,   title:'Control de stock por categorías', desc:'Clasificación automática por edad: reproductores, crías, jóvenes y adultos. Se actualiza en tiempo real sin intervención manual.', foot:'5 categorías · Actualización automática' },
              { icon: <Calendar size={22} />,  title:'Calendario de eventos', desc:'Visualizá partos esperados, destetes y madurez reproductiva en un calendario mensual con alertas de vencimiento.', foot:'Alertas · Vencidas · Próximas' },
              { icon: <Skull size={22} />,     title:'Registro de sacrificios', desc:'Registrá los sacrificios por grupo con fecha, categoría y notas. El stock se descuenta automáticamente y queda el historial completo.', foot:'Trazabilidad completa · Sin errores' },
              { icon: <Printer size={22} />,   title:'Reportes e impresión', desc:'Generá reportes mensuales o personalizados listos para imprimir o exportar como PDF. Ideales para auditorías y registros institucionales.', foot:'PDF · Impresión directa · Filtros' },
            ].map(({ icon, title, desc, foot }) => (
              <div key={title} className="card feature-card" style={{ borderRadius: '20px', padding: '28px', background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: tema.accentDim, border: `1px solid ${tema.accentBorde}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tema.accent, marginBottom: '20px' }}>{icon}</div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: tema.textPrimary, marginBottom: '10px' }}>{title}</h3>
                <p style={{ fontSize: '14px', color: tema.textSecondary, lineHeight: 1.6 }}>{desc}</p>
                <div className="mono" style={{ fontSize: '11px', color: tema.textMuted, marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${tema.bgCardBorde}` }}>{foot}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section id="como-funciona" className="landing-section-pad" style={{ padding: '100px 24px', background: modoBrillo ? '#EEEEE9' : 'rgba(13,21,40,0.3)', borderTop: `1px solid ${tema.bgCardBorde}`, borderBottom: `1px solid ${tema.bgCardBorde}` }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: '20px', background: tema.accentDim, border: `1px solid ${tema.accentBorde}`, marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: tema.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>Simple desde el día 1</span>
          </div>
          <h2 className="landing-section-h2" style={{ fontSize: '40px', fontWeight: 800, color: tema.textPrimary, letterSpacing: '-1px', marginBottom: '60px' }}>¿Cómo funciona?</h2>

          <div className="landing-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '40px', position: 'relative' }}>
            <div className="landing-steps-line" style={{ position: 'absolute', top: '32px', left: 'calc(16.6% + 16px)', right: 'calc(16.6% + 16px)', height: '1px', background: `linear-gradient(90deg, transparent, ${tema.accentBorde}, transparent)` }} />
            {[
              { n:'01', title:'Cargás tus animales', desc:'Registrás machos y hembras reproductoras con su código, fecha de nacimiento y linaje.' },
              { n:'02', title:'Registrás los apareamientos', desc:'Con la fecha de cópula, el sistema calcula automáticamente la ventana de parto esperada.' },
              { n:'03', title:'El sistema trabaja solo', desc:'Alertas automáticas, stock actualizado, ranking de reproductores y reportes listos para imprimir.' },
            ].map(({ n, title, desc }) => (
              <div key={n}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: tema.accentDim, border: `2px solid ${tema.accentBorde}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', position: 'relative' }}>
                  <span className="mono" style={{ fontSize: '20px', fontWeight: 700, color: tema.accent }}>{n}</span>
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: tema.textPrimary, marginBottom: '10px' }}>{title}</h3>
                <p style={{ fontSize: '14px', color: tema.textSecondary, lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARA QUIÉN ── */}
      <section className="landing-section-pad" style={{ padding: '100px 24px', background: tema.bgMain }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 className="landing-section-h2" style={{ fontSize: '40px', fontWeight: 800, color: tema.textPrimary, letterSpacing: '-1px', marginBottom: '16px' }}>¿Para quién es ITeRatE?</h2>
            <p style={{ fontSize: '16px', color: tema.textSecondary }}>Diseñado para instituciones que trabajan con colonias de ratones de laboratorio</p>
          </div>
          <div className="landing-para-quien-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
            {[
              [<GraduationCap size={36} />, 'Universidades',             'Facultades de medicina, biología y veterinaria con bioterios propios'],
              [<Microscope size={36} />,    'Institutos de investigación','CONICET, INTA, ANLIS y centros de investigación biomédica'],
              [<FlaskConical size={36} />,  'Laboratorios farmacéuticos', 'Empresas que requieren modelos animales para sus estudios'],
              [<Building2 size={36} />,     'Hospitales y clínicas',      'Centros con unidades de investigación y bioterios satelitales'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="card" style={{ borderRadius: '16px', padding: '24px', textAlign: 'center', background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center', color: tema.accent }}>{icon}</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: tema.textPrimary, marginBottom: '8px' }}>{title}</div>
                <div style={{ fontSize: '13px', color: tema.textMuted, lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="landing-section-pad" style={{ padding: '100px 24px', background: modoBrillo ? '#EEEEE9' : 'rgba(13,21,40,0.3)', borderTop: `1px solid ${tema.bgCardBorde}`, borderBottom: `1px solid ${tema.bgCardBorde}` }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: '20px', background: tema.accentDim, border: `1px solid ${tema.accentBorde}`, marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: tema.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>Planes</span>
          </div>
          <h2 className="landing-section-h2" style={{ fontSize: '40px', fontWeight: 800, color: tema.textPrimary, letterSpacing: '-1px', marginBottom: '16px' }}>Elegí el modelo que mejor te funciona</h2>
          <p style={{ fontSize: '16px', color: tema.textSecondary, marginBottom: '60px' }}>Consultoría personalizada sin compromiso. Ajustamos el plan a las necesidades de tu institución.</p>

          <div className="landing-pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="card landing-pricing-card" style={{ borderRadius: '24px', padding: '40px', textAlign: 'left', background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: tema.textMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Licencia única</div>
              <div style={{ fontSize: '40px', fontWeight: 900, color: tema.textPrimary, marginBottom: '8px' }}>A consultar</div>
              <div style={{ fontSize: '14px', color: tema.textMuted, marginBottom: '32px' }}>Pago único · sin mensualidades</div>
              <div style={{ borderTop: `1px solid ${tema.bgCardBorde}`, paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Sistema completo instalado','Capacitación incluida','3 meses de soporte técnico','Acceso multiusuario'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: tema.textSecondary }}>
                    <span style={{ color: tema.accent, fontWeight: 700 }}>✓</span> {f}
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: tema.textMuted }}>
                  <span style={{ fontWeight: 700 }}>—</span> Updates futuros opcionales
                </div>
              </div>
              <a href="#contacto" style={{ display: 'block', marginTop: '32px', padding: '14px', borderRadius: '12px', textAlign: 'center', fontSize: '15px', fontWeight: 600, textDecoration: 'none', color: tema.textSecondary, background: modoBrillo ? '#E8E8E3' : 'rgba(30,51,82,0.5)', border: `1px solid ${tema.bgCardBorde}` }}>
                Consultar precio
              </a>
            </div>

            <div className="landing-pricing-card" style={{ borderRadius: '24px', padding: '40px', textAlign: 'left', position: 'relative', overflow: 'hidden', background: tema.bgCard, border: `1.5px solid ${tema.accentBorde}`, boxShadow: modoBrillo ? '0 4px 16px rgba(0,0,0,0.08)' : '0 0 40px rgba(0,230,118,0.1)' }}>
              <div style={{ position: 'absolute', top: '20px', right: '20px', padding: '4px 12px', borderRadius: '20px', background: tema.accentDim, border: `1px solid ${tema.accentBorde}` }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: tema.accent, textTransform: 'uppercase', letterSpacing: '1px' }}>⭐ Recomendado</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: tema.accent, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Suscripción mensual</div>
              <div style={{ fontSize: '40px', fontWeight: 900, color: tema.textPrimary, marginBottom: '8px' }}>A consultar</div>
              <div style={{ fontSize: '14px', color: tema.textMuted, marginBottom: '32px' }}>por mes · sin contrato de permanencia</div>
              <div style={{ borderTop: `1px solid ${tema.accentBorde}`, paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Todo lo del plan licencia','Updates automáticos incluidos','Soporte técnico continuo','Nuevas funciones sin costo extra','Backup automático de datos'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: tema.textSecondary }}>
                    <span style={{ color: tema.accent, fontWeight: 700 }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <a href="#contacto" style={{ display: 'block', marginTop: '32px', padding: '14px', borderRadius: '12px', textAlign: 'center', fontSize: '15px', fontWeight: 700, textDecoration: 'none', color: modoBrillo ? '#ffffff' : '#050810', background: modoBrillo ? '#111111' : 'linear-gradient(135deg, #00e676, #40c4ff)', boxShadow: modoBrillo ? 'none' : '0 4px 20px rgba(0,230,118,0.25)' }}>
                Consultar precio
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACTO ── */}
      <section id="contacto" className="landing-section-pad" style={{ padding: '100px 24px 40px', background: tema.bgMain }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}><Dna size={48} style={{ color: tema.accent }} /></div>
          <h2 className="landing-section-h2" style={{ fontSize: '40px', fontWeight: 800, color: tema.textPrimary, letterSpacing: '-1px', marginBottom: '16px' }}>Pedí tu demo gratuito</h2>
          <p style={{ fontSize: '16px', color: tema.textSecondary, marginBottom: '48px', lineHeight: 1.7 }}>
            Te mostramos el sistema en funcionamiento con datos reales. Sin compromiso, sin tarjeta de crédito.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
            <div className="landing-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: tema.textMuted, marginBottom: '8px' }}>Nombre</label>
                <input type="text" name="nombre" required placeholder="Tu nombre" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: tema.textMuted, marginBottom: '8px' }}>Institución</label>
                <input type="text" name="institucion" placeholder="Nombre de tu institución" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: tema.textMuted, marginBottom: '8px' }}>Email</label>
              <input type="email" name="email" required placeholder="tu@institución.edu.ar" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: tema.textMuted, marginBottom: '8px' }}>
                Mensaje <span style={{ fontWeight: 400, opacity: 0.5 }}>(opcional)</span>
              </label>
              <textarea name="mensaje" rows={3} placeholder="¿Cuántos animales manejan? ¿Qué herramienta usan actualmente?"
                style={{ ...inputStyle, resize: 'none' }} />
            </div>
            <button type="submit" id="submitBtn"
              style={{ padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: 700, color: modoBrillo ? '#ffffff' : '#050810', background: modoBrillo ? '#111111' : 'linear-gradient(135deg, #00e676, #40c4ff)', border: 'none', cursor: 'pointer', boxShadow: modoBrillo ? 'none' : '0 4px 24px rgba(0,230,118,0.3)', transition: 'opacity 0.2s', fontFamily: 'inherit' }}>
              Solicitar demo gratuito →
            </button>
            <div id="formMsg" style={{ display: 'none', padding: '14px', borderRadius: '10px', textAlign: 'center', fontSize: '14px' }} />
          </form>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: '0 24px', borderTop: `1px solid ${tema.bgCardBorde}`, background: tema.bgMain }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
          <img
            src={modoBrillo ? iterateTextLogoLight : iterateTextLogo}
            alt="ITeRatE"
            style={{
              width: '480px',
              maxWidth: '100%',
              height: 'auto',
              display: 'block',
              filter: modoBrillo ? 'none' : 'drop-shadow(0 0 20px rgba(0,230,118,0.2))',
              opacity: 0.85,
              mixBlendMode: modoBrillo ? 'multiply' : 'screen',
            }}
          />
          <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <div className="mono" style={{ fontSize: '12px', color: tema.textMuted, whiteSpace: 'nowrap', textAlign: 'right' }}>© 2026 ITeRatE</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
