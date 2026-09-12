import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloudUploadOutlined,
  ColumnWidthOutlined,
  CopyOutlined,
  FileImageOutlined,
  FontSizeOutlined,
  LeftOutlined,
  LayoutOutlined,
  LineChartOutlined,
  PictureOutlined,
  RightOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  ThunderboltFilled,
  ToolOutlined
} from '@ant-design/icons';
import './uiPrototype.css';

type VariantKey = 'apple' | 'orbit' | 'studio';

type VariantDefinition = {
  key: VariantKey;
  label: string;
  subtitle: string;
};

const variants: VariantDefinition[] = [
  { key: 'apple', label: 'Apple Command Center', subtitle: '克制、清晰、任务优先' },
  { key: 'orbit', label: 'Orbit Workspace', subtitle: '实时、沉浸、画布优先' },
  { key: 'studio', label: 'Studio Catalog', subtitle: '高密度、可扫描、资源优先' }
];

const shopCards = [
  { name: '3 号店', code: 'LuxeJoy', products: 16, orders: 24, sizeTemplates: 18, fontTemplates: 6, progress: 82, tone: 'blue' },
  { name: '婚礼定制店', code: 'WeddingLab', products: 11, orders: 12, sizeTemplates: 9, fontTemplates: 4, progress: 58, tone: 'mint' },
  { name: '纪念册专营', code: 'MemoryCo', products: 8, orders: 8, sizeTemplates: 14, fontTemplates: 7, progress: 41, tone: 'amber' }
];

const recentJobs = [
  { label: '春日婚礼 · 封面模板', meta: '3 号店 · 2 分钟前', type: 'PSD', status: 'ready' },
  { label: '宝宝成长册 · 内页模块', meta: '婚礼定制店 · 18 分钟前', type: 'SVG', status: 'working' },
  { label: '纪念册 · 尺寸模板', meta: '纪念册专营 · 昨天', type: 'PDF', status: 'ready' }
];

function readVariant(): VariantKey {
  if (typeof window === 'undefined') return 'apple';
  const fromSearch = new URLSearchParams(window.location.search).get('variant');
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  const fromHash = new URLSearchParams(hashQuery).get('variant');
  const candidate = fromSearch || fromHash;
  return variants.some((item) => item.key === candidate) ? candidate as VariantKey : 'apple';
}

function writeVariant(next: VariantKey): void {
  const url = new URL(window.location.href);
  if (url.hash.includes('?')) {
    const [route] = url.hash.split('?');
    url.hash = `${route}?variant=${next}`;
  } else {
    url.searchParams.set('variant', next);
  }
  window.history.replaceState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function PrototypeSwitcher({ current, onChange }: { current: VariantKey; onChange(next: VariantKey): void }) {
  const index = variants.findIndex((item) => item.key === current);
  const cycle = (delta: number) => onChange(variants[(index + delta + variants.length) % variants.length].key);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowLeft') cycle(-1);
      if (event.key === 'ArrowRight') cycle(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div className="ui-prototype-switcher" role="group" aria-label="切换 UI 原型方案">
      <button type="button" aria-label="上一个方案" onClick={() => cycle(-1)}><LeftOutlined /></button>
      <span><b>{String(index + 1).padStart(2, '0')}</b>{variants[index].label}</span>
      <button type="button" aria-label="下一个方案" onClick={() => cycle(1)}><RightOutlined /></button>
    </div>
  );
}

function TiltCard({ className = '', children }: { className?: string; children: ReactNode }) {
  const [style, setStyle] = useState<CSSProperties>({});
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const rotateX = ((event.clientY - rect.top) / rect.height - 0.5) * -5;
    const rotateY = ((event.clientX - rect.left) / rect.width - 0.5) * 6;
    setStyle({ '--card-rotate-x': `${rotateX}deg`, '--card-rotate-y': `${rotateY}deg` } as CSSProperties);
  };
  return <div className={`ui-tilt-card ${className}`} style={style} onPointerMove={handlePointerMove} onPointerLeave={() => setStyle({})}>{children}</div>;
}

function Header({ variant, onChange }: { variant: VariantKey; onChange(next: VariantKey): void }) {
  const definition = variants.find((item) => item.key === variant)!;
  return (
    <header className="ui-prototype-header">
      <div className="ui-prototype-brand"><span className="ui-brand-mark">A</span><span><b>ALBUM / LAB</b><small>设计生产工作台</small></span></div>
      <div className="ui-prototype-context"><span className="ui-kicker">DESIGN SYSTEM EXPLORATION</span><strong>{definition.label}</strong><small>{definition.subtitle}</small></div>
      <div className="ui-prototype-header-actions"><button type="button" className="ui-icon-button" aria-label="上传资源"><CloudUploadOutlined /></button><button type="button" className="ui-avatar">CY</button></div>
      <PrototypeSwitcher current={variant} onChange={onChange} />
    </header>
  );
}

function Sidebar({ active }: { active: string }) {
  const items = [
    ['总览', BarChartOutlined, 'overview'],
    ['订单', ClockCircleOutlined, 'orders'],
    ['模板库', AppstoreOutlined, 'templates'],
    ['内页模块', LayoutOutlined, 'pages'],
    ['资源与字体', ToolOutlined, 'assets']
  ] as const;
  return <aside className="ui-prototype-sidebar"><div className="ui-side-label">WORKSPACE</div>{items.map(([label, Icon, key]) => <button className={active === key ? 'active' : ''} type="button" key={key}><Icon /><span>{label}</span>{key === 'orders' && <em>12</em>}</button>)}<div className="ui-side-spacer" /><div className="ui-side-status"><span className="ui-live-dot" />同步正常<small>刚刚更新</small></div></aside>;
}

function Metric({ label, value, change, trend = 'up' }: { label: string; value: string; change: string; trend?: 'up' | 'down' }) {
  return <div className="ui-metric"><span>{label}</span><strong>{value}</strong><small className={trend}>{trend === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{change}</small></div>;
}

function ShopField({ label, value, icon: Icon }: { label: string; value: number; icon: typeof AppstoreOutlined }) {
  return <div className="ui-shop-field"><Icon aria-hidden="true" /><span>{label}</span><strong>{value}</strong></div>;
}

function AppleVariant() {
  const [activeShop, setActiveShop] = useState(0);
  const shop = shopCards[activeShop];
  return <div className="ui-prototype-shell variant-apple"><Sidebar active="overview" /><main className="ui-prototype-main"><div className="ui-page-intro"><div><span className="ui-kicker">TUESDAY · 05 SEPTEMBER 2026</span><h1>早上好，Cindy<span className="ui-title-dot">.</span></h1><p>今天有 <b>12 个订单</b> 等待处理，3 个模板需要复核。</p></div><button type="button" className="ui-primary-button"><ThunderboltFilled />开始排版</button></div><div className="ui-metric-row"><Metric label="待处理订单" value="12" change="18.4%" /><Metric label="本周已导出" value="86" change="12.1%" /><Metric label="活跃模板" value="42" change="6.8%" /><Metric label="素材资源" value="1,284" change="3.2%" trend="down" /></div><div className="ui-section-heading"><div><span className="ui-kicker">SHOP PULSE</span><h2>店铺状态</h2></div><button type="button" className="ui-text-button">查看全部 <RightOutlined /></button></div><div className="ui-shop-grid">{shopCards.map((item, index) => <TiltCard className={`ui-shop-card tone-${item.tone} ${activeShop === index ? 'selected' : ''}`} key={item.code}><button type="button" className="ui-card-hit-area" onClick={() => setActiveShop(index)} aria-label={`查看 ${item.name}`}><div className="ui-card-top"><span className="ui-shop-glyph"><ShopOutlined /></span><span className="ui-status-pill"><span />运行中</span></div><span className="ui-card-code">{item.code}</span><h3>{item.name}</h3><div className="ui-shop-fields"><ShopField label="商品" value={item.products} icon={AppstoreOutlined} /><ShopField label="订单" value={item.orders} icon={ShoppingCartOutlined} /><ShopField label="尺寸模板" value={item.sizeTemplates} icon={ColumnWidthOutlined} /><ShopField label="字体模板" value={item.fontTemplates} icon={FontSizeOutlined} /></div><div className="ui-progress"><span style={{ width: `${item.progress}%` }} /></div><small>本周生产完成度 {item.progress}%</small></button></TiltCard>)}</div><div className="ui-lower-grid"><TiltCard className="ui-chart-card"><div className="ui-card-heading"><div><span className="ui-kicker">THROUGHPUT</span><h3>订单处理趋势</h3></div><span className="ui-period">近 7 天 <RightOutlined /></span></div><div className="ui-sparkline"><span className="spark-line" /><span className="spark-point point-1" /><span className="spark-point point-2" /><span className="spark-point point-3" /><span className="spark-point point-4" /><span className="spark-point point-5" /></div><div className="ui-chart-axis"><span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>周日</span></div></TiltCard><TiltCard className="ui-focus-card"><div className="ui-card-heading"><div><span className="ui-kicker">ACTIVE SHOP</span><h3>{shop.name}</h3></div><span className="ui-focus-icon"><LineChartOutlined /></span></div><strong className="ui-focus-number">{shop.progress}%</strong><p>模板生产完成度</p><div className="ui-focus-list"><span><CheckCircleFilled />尺寸模板已同步</span><span><CheckCircleFilled />字体资源已就绪</span></div></TiltCard></div></main></div>;
}

function OrbitVariant() {
  const [running, setRunning] = useState(false);
  return <div className="ui-prototype-shell variant-orbit"><aside className="ui-orbit-rail"><div className="ui-orbit-logo">A<span /></div>{[BarChartOutlined, ShopOutlined, PictureOutlined, ToolOutlined].map((Icon, index) => <button type="button" className={index === 0 ? 'active' : ''} key={index} aria-label={`导航 ${index + 1}`}><Icon /></button>)}<div className="ui-side-spacer" /><button type="button" className="ui-orbit-avatar">C</button></aside><main className="ui-orbit-main"><div className="ui-orbit-topbar"><div><span className="ui-kicker">LIVE WORKSPACE / 03</span><h1>Production orbit</h1></div><div className="ui-orbit-actions"><span className="ui-live-label"><span className="ui-live-dot" />实时同步</span><button type="button" className="ui-ghost-button"><CopyOutlined />复制链接</button></div></div><div className="ui-orbit-command"><div className="ui-command-copy"><span className="ui-kicker">NEXT BEST ACTION</span><h2>完成 LuxeJoy 的封面复核</h2><p>订单 #LJ-2048 · Wedding Guest Book · 还有 2 个安全距离需要确认</p><button type="button" className="ui-command-button" onClick={() => setRunning((value) => !value)}>{running ? '正在打开工作区' : '进入编辑器'}<RightOutlined /></button></div><div className="ui-command-orbit"><span className="orbit-ring ring-one" /><span className="orbit-ring ring-two" /><span className="orbit-core"><PictureOutlined /></span><span className="orbit-ping ping-one" /><span className="orbit-ping ping-two" /></div></div><div className="ui-orbit-columns"><div className="ui-orbit-column"><div className="ui-section-heading"><div><span className="ui-kicker">SHOP STATUS</span><h2>店铺概览</h2></div><span className="ui-quiet-label">实时数据</span></div><div className="ui-orbit-shop-list">{shopCards.map((item) => <TiltCard className="ui-orbit-shop-row" key={item.code}><div><b>{item.name}</b><small>{item.code}</small></div><div className="ui-orbit-shop-counts"><span>商品 <strong>{item.products}</strong></span><span>订单 <strong>{item.orders}</strong></span><span>尺寸 <strong>{item.sizeTemplates}</strong></span><span>字体 <strong>{item.fontTemplates}</strong></span></div><span className="ui-orbit-shop-state"><span />正常</span></TiltCard>)}</div></div><div className="ui-orbit-column"><div className="ui-section-heading"><div><span className="ui-kicker">ACTIVITY STREAM</span><h2>最近活动</h2></div><button type="button" className="ui-quiet-label">展开</button></div><div className="ui-activity-stream">{recentJobs.map((job) => <div className="ui-activity-row" key={job.label}><span className={`ui-file-badge file-${job.type.toLowerCase()}`}>{job.type}</span><div><b>{job.label}</b><small>{job.meta}</small></div><span className={`ui-activity-state ${job.status}`} /> </div>)}</div></div></div></main></div>;
}

function StudioVariant() {
  const [activeTab, setActiveTab] = useState('全部项目');
  const tabs = ['全部项目', '待处理', '模板复核', '已导出'];
  return <div className="ui-prototype-shell variant-studio"><aside className="ui-studio-sidebar"><div className="ui-studio-brand"><span className="ui-brand-mark">A</span><b>album lab</b></div><div className="ui-side-label">COLLECTIONS</div>{['全部项目', '订单生产', '模板库', '内页模块'].map((item) => <button type="button" className={activeTab === item ? 'active' : ''} key={item} onClick={() => setActiveTab(item)}><span className="ui-collection-dot" />{item}<span className="ui-side-count">{item === '全部项目' ? '36' : item === '订单生产' ? '12' : '24'}</span></button>)}<div className="ui-side-spacer" /><div className="ui-studio-footer"><span className="ui-avatar">CY</span><div><b>Cindy</b><small>设计师</small></div><RightOutlined /></div></aside><main className="ui-studio-main"><div className="ui-studio-toolbar"><div><span className="ui-kicker">PROJECT INDEX / 2026</span><h1>项目与模板</h1></div><div className="ui-studio-tools"><button type="button" className="ui-filter-button">筛选 <span>3</span></button><button type="button" className="ui-primary-button"><ThunderboltFilled />新建项目</button></div></div><div className="ui-studio-tabs">{tabs.map((tab) => <button type="button" className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => setActiveTab(tab)}>{tab}<span>{tab === '全部项目' ? '36' : tab === '待处理' ? '12' : tab === '模板复核' ? '3' : '86'}</span></button>)}</div><div className="ui-studio-grid"><TiltCard className="ui-feature-project"><div className="ui-project-preview preview-wedding"><span>WEDDING<br /><i>guest book</i></span><small>PREVIEW / 01</small></div><div className="ui-project-meta"><div><span className="ui-kicker">LUXEJOY · ACTIVE</span><h2>Wedding Guest Book</h2><p>封面模板 · 12 × 8.5 in · 3 个版本</p></div><button type="button" className="ui-round-button" aria-label="打开项目"><RightOutlined /></button></div></TiltCard>{shopCards.slice(0, 2).map((shop, index) => <TiltCard className="ui-project-card" key={shop.code}><div className={`ui-project-preview preview-${index === 0 ? 'linen' : 'paper'}`}><span>{index === 0 ? 'LuxeJoy' : 'MemoryCo'}</span><small>{index === 0 ? '06' : '14'} TEMPLATES</small></div><div className="ui-project-meta"><div><span className="ui-kicker">{shop.code}</span><h3>{index === 0 ? '春日婚礼系列' : '纪念册系列'}</h3><p>{shop.products} 个商品 · {shop.orders} 个订单</p><p>{shop.sizeTemplates} 个尺寸模板 · {shop.fontTemplates} 个字体模板</p></div><button type="button" className="ui-round-button" aria-label="打开项目"><RightOutlined /></button></div></TiltCard>)}</div><div className="ui-studio-bottom"><div className="ui-section-heading"><div><span className="ui-kicker">QUEUE</span><h2>最近生产队列</h2></div><button type="button" className="ui-text-button">查看日志 <RightOutlined /></button></div><div className="ui-queue-table">{recentJobs.map((job, index) => <div className="ui-queue-row" key={job.label}><span className="ui-queue-index">0{index + 1}</span><span className="ui-queue-name">{job.label}</span><span className="ui-queue-meta">{job.meta}</span><span className={`ui-queue-tag ${job.status}`}>{job.status === 'ready' ? '已完成' : '处理中'}</span><span className="ui-queue-arrow"><RightOutlined /></span></div>)}</div></div></main></div>;
}

export default function UIPrototypePage() {
  const [variant, setVariant] = useState<VariantKey>(readVariant);
  const activeVariant = useMemo(() => variants.find((item) => item.key === variant)!, [variant]);
  const handleChange = (next: VariantKey) => {
    setVariant(next);
    writeVariant(next);
  };
  useEffect(() => {
    const sync = () => setVariant(readVariant());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);
  return <div className="ui-prototype-page"><Header variant={variant} onChange={handleChange} /><div className="ui-prototype-variant-label"><span>PROTOTYPE</span>{activeVariant.label}</div>{variant === 'apple' && <AppleVariant />}{variant === 'orbit' && <OrbitVariant />}{variant === 'studio' && <StudioVariant />}</div>;
}
