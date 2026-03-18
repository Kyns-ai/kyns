import acceptableUseMarkdown from './content/acceptable-use.md?raw';
import contentPolicyMarkdown from './content/content-policy.md?raw';
import privacyMarkdown from './content/privacy.md?raw';
import termsMarkdown from './content/terms.md?raw';

export type SiteLink = {
  href: string;
  label: string;
  external?: boolean;
};

export type SiteCard = {
  eyebrow?: string;
  title: string;
  description: string;
};

export type PhilosophyPillar = {
  id: string;
  numeral: string;
  philosopher: string;
  years: string;
  quote: string;
  paragraphs: string[];
  principle: string;
};

export type FAQCategory = {
  title: string;
  items: {
    question: string;
    answer: string;
  }[];
};

export const siteConfig = {
  rootUrl: 'https://kyns.ai',
  accessUrl: 'https://chat.kyns.ai',
  tagline: 'A verdade não precisa de permissão.',
  subtag: 'κυνικός — o que não se curva.',
  heroBadge: 'grátis · privado',
  contactEmail: 'contact@kyns.ai',
  copyright: '© 2026 KYNS LLC — Delaware, USA',
  footerTagline: 'κυνικός — a verdade não precisa de permissão',
  disclaimer:
    'Todo conteúdo é gerado por inteligência artificial. Personagens são fictícios. O usuário é responsável pelo conteúdo que gera. Ao usar a plataforma, você aceita nossos Termos de Uso.',
} as const;

export const navigationLinks: SiteLink[] = [
  { href: '/about', label: 'Sobre' },
  { href: '/philosophy', label: 'Filosofia' },
  { href: '/transparency', label: 'Transparência' },
  { href: '/faq', label: 'FAQ' },
];

export const footerColumns = [
  {
    title: 'Plataforma',
    links: [
      { href: siteConfig.accessUrl, label: 'Acessar KYNS', external: true },
      { href: '/about', label: 'Sobre' },
      { href: '/philosophy', label: 'Filosofia' },
      { href: '/transparency', label: 'Transparência' },
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Termos de Uso' },
      { href: '/privacy', label: 'Política de Privacidade' },
      { href: '/content-policy', label: 'Política de Conteúdo' },
      { href: '/acceptable-use', label: 'Uso Aceitável' },
    ],
  },
  {
    title: 'Contato',
    links: [{ href: '/contact', label: siteConfig.contactEmail }],
  },
] as const;

export const toolResponsibilityQuote =
  'Uma faca pode alimentar uma família ou tirar uma vida. Uma chave de fenda pode construir uma casa ou arrombar uma porta. O problema nunca esteve na ferramenta. A responsabilidade é de quem usa — e sempre foi. Proibir a ferramenta é tratar todo mundo como criminoso. Nós tratamos você como adulto.';

export const toolResponsibilityLines = [
  'Uma faca pode alimentar uma família ou tirar uma vida.',
  'Uma chave de fenda pode construir uma casa ou arrombar uma porta.',
  'O problema nunca esteve na ferramenta.',
  'A responsabilidade é de quem usa — e sempre foi.',
  'Proibir a ferramenta é tratar todo mundo como criminoso.',
  'Nós tratamos você como adulto.',
] as const;

export const libraryQuote =
  'Uma biblioteca contém todo o conhecimento humano — inclusive o perigoso. Ninguém culpa o bibliotecário pelo que o leitor faz com o que leu. Ninguém culpa o autor por como suas palavras foram interpretadas. Ninguém culpa a biblioteca por existir. O KYNS é uma biblioteca digital. O que você lê e o que você faz é responsabilidade sua.';

export const pageMeta = {
  home: {
    path: '/',
    title: 'KYNS | A verdade não precisa de permissão',
    description: 'Inteligência artificial sem censura, com dados que expiram automaticamente. Porque o acesso à informação é um direito, não um privilégio.',
  },
  about: {
    path: '/about',
    title: 'Sobre o KYNS',
    description: 'Conheça a base filosófica, a arquitetura de privacidade e a tese do KYNS sobre autonomia, responsabilidade e IA.',
  },
  philosophy: {
    path: '/philosophy',
    title: 'A Filosofia KYNS',
    description: 'Diógenes, Aristóteles, Epictetus, Mill, Nietzsche e Sartre como base de uma IA que não infantiliza o usuário.',
  },
  transparency: {
    path: '/transparency',
    title: 'Transparência KYNS',
    description: 'Prompt público, fluxo de dados, arquitetura de privacidade, modelos usados e limites objetivos da plataforma.',
  },
  faq: {
    path: '/faq',
    title: 'FAQ KYNS',
    description: 'Perguntas frequentes sobre privacidade, conteúdo, conta, modelos, segurança e funcionamento da plataforma.',
  },
  terms: {
    path: '/terms',
    title: 'Termos de Uso | KYNS',
    description: 'Termos de Uso do KYNS, incluindo elegibilidade, arbitragem obrigatória em Delaware e responsabilidades do usuário.',
  },
  privacy: {
    path: '/privacy',
    title: 'Política de Privacidade | KYNS',
    description: 'Como o KYNS coleta dados técnicos mínimos, evita armazenar conversas e separa conteúdo de logs operacionais.',
  },
  contentPolicy: {
    path: '/content-policy',
    title: 'Política de Conteúdo | KYNS',
    description: 'O que é permitido, o que é proibido e por que o KYNS restringe apenas dano direto, menores e WMD.',
  },
  acceptableUse: {
    path: '/acceptable-use',
    title: 'Uso Aceitável | KYNS',
    description: 'Regras de uso aceitável da plataforma KYNS para exploração criativa, pesquisa, produtividade e uso responsável.',
  },
  contact: {
    path: '/contact',
    title: 'Contato | KYNS',
    description: 'Canal único de contato para suporte, copyright, privacidade, abusos e assuntos gerais do KYNS.',
  },
} as const;

export const homeContent = {
  hero: {
    eyebrow: 'κυνικός',
    title: siteConfig.tagline,
    description:
      'Inteligência artificial sem censura, com dados que expiram automaticamente. Porque o acesso à informação é um direito, não um privilégio.',
    primaryCta: 'Acessar o KYNS',
    secondaryCta: 'Ler a filosofia',
    supportText:
      'Conversas deletadas em 24h. Livre por design. Baseada em tecnologia open-source.',
  },
  toolSection: {
    eyebrow: 'A FERRAMENTA',
    title: 'Proibir a ferramenta é tratar todo mundo como criminoso.',
    description:
      'Nós tratamos você como adulto. A ferramenta permanece neutra; a responsabilidade continua com quem pergunta, interpreta e age.',
  },
  privacyCards: [
    {
      eyebrow: '01',
      title: 'Deletado em 24h',
      description:
        'Conversas e imagens geradas são automaticamente deletadas do servidor após 24 horas. Nenhum histórico é retido permanentemente.',
    },
    {
      eyebrow: '02',
      title: 'Sem treino',
      description:
        'Seus dados nunca são usados para treinar modelos. A sessão existe para responder, não para coletar.',
    },
    {
      eyebrow: '03',
      title: 'Acesso mínimo',
      description:
        'Após o prazo de 24h, o conteúdo das conversas é permanentemente deletado. Não há histórico persistente a entregar.',
    },
  ] satisfies SiteCard[],
  librarySection: {
    eyebrow: 'A BIBLIOTECA',
    title: 'Uma biblioteca digital, não uma babá algorítmica.',
    description:
      'O KYNS parte da ideia de que acesso a conhecimento não é ameaça em si. O limite é dano direto, não desconforto intelectual.',
  },
  whatKynsDoes: [
    {
      eyebrow: 'CHAT',
      title: 'Chat sem mordaça',
      description:
        'IA avançada com respostas diretas, sem o tom corporativo de desculpa automática e sem filtro ideológico como padrão.',
    },
    {
      eyebrow: 'IMAGEM',
      title: 'Geração de imagens',
      description:
        'Arte, conceitos, personagens e cenas visuais com uma stack própria para qualidade, velocidade e criatividade sem limites artificiais.',
    },
    {
      eyebrow: 'PERSONAGENS',
      title: 'Personagens',
      description:
        'Personagens com personalidade própria para roleplay, conversa, mentoria e exploração criativa sem filtros corporativos desnecessários.',
    },
    {
      eyebrow: 'PRIVACIDADE',
      title: 'Privacidade real',
      description:
        'Conversas deletadas em 24h, sem uso para treino e sem transformar sua curiosidade em perfil de comportamento permanente.',
    },
  ] satisfies SiteCard[],
  diogenesSection: {
    eyebrow: 'DIÓGENES',
    title: 'Procuro um homem honesto.',
    description:
      'Quando Alexandre ofereceu qualquer coisa a Diógenes, ele respondeu: "Sai da frente do meu sol." KYNS vem de κυνικός, o cínico que não se curva a poder, dinheiro ou convenção quando estes atrapalham a verdade.',
  },
  finalCta: {
    eyebrow: 'A LANTERNA ESTÁ ACESA',
    title: 'A pergunta é sua. A resposta é sua. A responsabilidade é sua.',
    description:
      'Se o conhecimento pode existir sem ferir terceiros, ele não precisa de permissão prévia. É essa a linha do KYNS.',
    button: 'Começar agora',
    badge: 'grátis · privado · sem censura',
  },
} as const;

export const aboutContent = {
  hero: {
    eyebrow: 'SOBRE O KYNS',
    title: 'Bem-vindo ao KYNS',
    description:
      'KYNS foi construído sobre um princípio: a inteligência artificial só serve à humanidade quando respeita a soberania de quem a usa. Privada por padrão. Livre por design. Baseada em tecnologia open-source.',
  },
  architectureSteps: [
    {
      eyebrow: 'STEP 1',
      title: 'Criptografia em trânsito',
      description:
        'Mensagens trafegam por HTTPS/TLS até a borda do serviço. O KYNS protege o caminho da sua requisição sem transformar esse trânsito em arquivo permanente.',
    },
    {
      eyebrow: 'STEP 2',
      title: 'Fluxo direto',
      description:
        'A resposta é streamada de volta para o navegador em tempo real. A plataforma existe para entregar a resposta, não para colecionar seu conteúdo.',
    },
    {
      eyebrow: 'STEP 3',
      title: 'Retenção mínima e temporária',
      description:
        'Conversas e imagens ficam no servidor por até 24 horas para continuidade de sessão, depois são deletadas permanentemente e de forma automática.',
    },
  ] satisfies SiteCard[],
  biasBlocks: [
    {
      eyebrow: 'VIÉS IDEOLÓGICO',
      title: 'IAs corporativas ficam menos inteligentes quando tentam parecer moralmente impecáveis.',
      description:
        'Quando uma IA prioriza blindagem reputacional acima de verdade, nuance e contexto, ela responde pior. O KYNS recusa esse trade-off como padrão operacional.',
    },
    {
      eyebrow: 'CURIOSIDADE',
      title: 'Respostas paternalistas corroem exatamente o que a IA deveria incentivar.',
      description:
        'Uma ferramenta que pune curiosidade, omite contexto ou transforma toda pergunta em suspeita não expande inteligência. Ela a empobrece.',
    },
  ] satisfies SiteCard[],
  openSource: {
    eyebrow: 'OPEN SOURCE',
    title: 'Modelos abertos, critérios explícitos, menos teatro.',
    description:
      'O KYNS prioriza modelos open-source e infraestrutura auditável. Transparência, para nós, não é slogan de landing page: é mostrar a lógica da plataforma, o prompt mestre e os limites que realmente existem.',
  },
  responsibility: {
    eyebrow: 'RESPONSABILIDADE',
    title: 'Liberdade sem infantilização. Limites sem moralismo.',
    description:
      'Bloqueamos conteúdo sexual envolvendo menores, ataques reais identificáveis e instruções para armas de destruição em massa. Fora dessas linhas, a pergunta continua sendo sua.',
  },
} as const;

export const philosophyIntro = {
  eyebrow: 'SEIS PILARES',
  title: 'A Filosofia KYNS',
  description:
    'KYNS não nasceu de uma planilha de growth. Nasceu de uma posição filosófica: a verdade não precisa de permissão, a virtude exige conhecimento e responsabilidade moral não pode ser terceirizada para a ferramenta.',
} as const;

export const philosophyPillars: PhilosophyPillar[] = [
  {
    id: 'diogenes',
    numeral: 'I',
    philosopher: 'Diógenes de Sinope',
    years: 'c. 412 a.C. – 323 a.C.',
    quote: '“Sai da frente do meu sol.”',
    paragraphs: [
      'Diógenes recusava status, etiqueta e autoridade quando elas serviam apenas para proteger vaidade. Sua filosofia era um teste constante contra a mentira social confortável.',
      'KYNS herda essa recusa. Nenhuma corporação, governo ou algoritmo reputacional deveria decidir o que alguém pode saber quando o próprio conhecimento não constitui dano direto.',
    ],
    principle:
      'Princípio KYNS: a verdade não precisa de permissão. Nenhuma autoridade é grande demais para censurar o conhecimento.',
  },
  {
    id: 'aristotle',
    numeral: 'II',
    philosopher: 'Aristóteles',
    years: '384 a.C. – 322 a.C.',
    quote: '“Todos os homens, por natureza, desejam saber.”',
    paragraphs: [
      'Aristóteles distinguia ignorância de virtude. Uma escolha só pode ser moralmente valiosa quando nasce de compreensão, não de desconhecimento imposto de fora.',
      'É por isso que KYNS rejeita a tese de que censurar informação melhora pessoas. Quando você esconde o mundo, não produz caráter. Produz fragilidade travestida de pureza.',
    ],
    principle:
      'Princípio KYNS: o acesso ao conhecimento permite escolha virtuosa. Censurar não protege — infantiliza.',
  },
  {
    id: 'epictetus',
    numeral: 'III',
    philosopher: 'Epictetus',
    years: 'c. 50 d.C. – 135 d.C.',
    quote: '“Não são os eventos que perturbam os homens, mas o julgamento que fazem deles.”',
    paragraphs: [
      'Epictetus ensinava a separar o que está sob nosso controle do que não está. Ferramentas não carregam culpa moral em si; elas são meios disponíveis para ação humana.',
      'No KYNS, a responsabilidade recai sobre quem age. Punir a ferramenta porque alguém poderia abusar dela é deslocar a culpa para o objeto e absolver a agência humana.',
    ],
    principle:
      'Princípio KYNS: a responsabilidade é de quem age, não da ferramenta. Proibir a ferramenta é punir a maioria pelo potencial da minoria.',
  },
  {
    id: 'mill',
    numeral: 'IV',
    philosopher: 'John Stuart Mill',
    years: '1806 – 1873',
    quote: '“O poder só pode ser exercido sobre alguém para prevenir dano a outros.”',
    paragraphs: [
      'Mill formulou a linha mais importante da liberdade moderna: desconforto, ofensa e divergência não são dano. Restringir pensamento e expressão por hipótese moral é um abuso de poder.',
      'KYNS aplica esse limite à IA. O que bloqueamos não é o que incomoda, mas o que cruza a linha de dano direto: exploração sexual de menores, ataques reais identificáveis e WMD.',
    ],
    principle:
      'Princípio KYNS: a única restrição legítima é o dano direto a outros. Pensamento, expressão e acesso à informação não são dano.',
  },
  {
    id: 'nietzsche',
    numeral: 'V',
    philosopher: 'Friedrich Nietzsche',
    years: '1844 – 1900',
    quote: '“A moralidade é a melhor de todas as ferramentas para conduzir a humanidade pelo nariz.”',
    paragraphs: [
      'Nietzsche via a moralidade de rebanho como mecanismo de nivelamento por baixo. Em vez de elevar pessoas à autonomia, ela protege o conforto coletivo contra a diferença.',
      'O KYNS rejeita o menor denominador comum como régua de inteligência artificial. Não tratamos o usuário como alguém incapaz de pensar só porque há risco de crítica pública.',
    ],
    principle:
      'Princípio KYNS: não nivelamos pelo menor denominador. Tratamos cada pessoa como capaz de pensar por si mesma.',
  },
  {
    id: 'sartre',
    numeral: 'VI',
    philosopher: 'Jean-Paul Sartre',
    years: '1905 – 1980',
    quote: '“O homem está condenado a ser livre.”',
    paragraphs: [
      'Sartre fecha o arco: liberdade não é um prêmio opcional, é condição humana. E com ela vem responsabilidade radical por tudo o que se escolhe fazer.',
      'No KYNS, não existe “a IA me fez fazer isso”. A ferramenta responde. O usuário escolhe. A responsabilidade não desaparece porque a resposta veio de uma máquina.',
    ],
    principle:
      'Princípio KYNS: a liberdade é inescapável. A responsabilidade é total. O que você faz com a ferramenta define quem você é.',
  },
];

export const philosophySummary = [
  'A verdade não precisa de permissão.',
  'O conhecimento é caminho para virtude, não seu inimigo.',
  'A responsabilidade é de quem age, não da ferramenta.',
  'A única linha legítima é o dano direto a outros.',
  'Não nivelamos o usuário pelo menor denominador.',
  'Liberdade real vem com responsabilidade total.',
] as const;

export const transparencyContent = {
  hero: {
    eyebrow: 'TRANSPARÊNCIA',
    title: 'O que o KYNS faz, o que o KYNS não guarda e onde a linha realmente está.',
    description:
      'Confiança não nasce de promessa vaga. Ela nasce de arquitetura, limites objetivos e dados que somem automaticamente.',
  },
  storageAllowed: [
    'E-mail de conta, quando você se cadastra.',
    'Dados técnicos mínimos de operação, como IP, navegador, timestamps e telemetria de estabilidade.',
    'Conversas e imagens geradas por até 24 horas para continuidade de sessão — deletadas automaticamente após esse prazo.',
    'Memórias personalizadas, caso você as ative — controláveis e deletáveis a qualquer momento em Configurações.',
    'Informações de pagamento tratadas pelo provedor de cobrança, quando aplicável.',
  ],
  storageNotAllowed: [
    'Histórico de conversa retido permanentemente no servidor.',
    'Imagens geradas arquivadas além de 24 horas.',
    'Vinculação entre conteúdo da conversa e logs técnicos de infraestrutura.',
    'Treino de modelos com dados de usuário.',
  ],
  flowSteps: [
    {
      eyebrow: 'BROWSER',
      title: 'Seu navegador',
      description:
        'A sessão começa no dispositivo do usuário. As mensagens trafegam por HTTPS/TLS até a aplicação.',
    },
    {
      eyebrow: 'SERVIDOR',
      title: 'Servidor KYNS',
      description:
        'Conversas ficam temporariamente no servidor por até 24 horas para continuidade de sessão. Após esse prazo, são deletadas automaticamente.',
    },
    {
      eyebrow: 'MODEL',
      title: 'Runtime do modelo',
      description:
        'Modelos open-source recebem o contexto necessário para responder. Apenas conteúdo da mensagem é enviado — nunca e-mail, ID ou dados de conta.',
    },
    {
      eyebrow: 'DONE',
      title: 'Deleção automática',
      description:
        'Após 24 horas, conversas e imagens são permanentemente deletadas do servidor. Não há histórico persistente.',
    },
  ] satisfies SiteCard[],
  models: [
    {
      eyebrow: 'KYNS',
      title: 'Qwen3.5-27B heretic v2',
      description:
        'Base textual principal do chat rápido e do modo profundo, ajustada via prompt para respostas diretas, sem moralismo automático.',
    },
    {
      eyebrow: 'KYNS DEEP',
      title: 'Mesmo núcleo, outra disciplina',
      description:
        'O modo profundo usa a mesma base com instruções de maior densidade analítica e sem expor raciocínio oculto na interface final.',
    },
    {
      eyebrow: 'KYNS IMAGE',
      title: 'Stack dedicada de imagem',
      description:
        'Rotas otimizadas para geração de imagem com perfis de alta qualidade e iteração rápida, incluindo `flux2klein`, `zimage` e presets específicos por caso.',
    },
  ] satisfies SiteCard[],
  limits: [
    {
      eyebrow: 'CSAM',
      title: 'Menores em contexto sexual',
      description:
        'Não é debate filosófico. É linha objetiva. Menor não consente; impedir isso não é censura, é proteção de vítima.',
    },
    {
      eyebrow: 'ATAQUES REAIS',
      title: 'Planejamento de dano concreto',
      description:
        'Quando a instrução sai do campo abstrato e entra em ataque específico contra alvo real identificável, a linha de Mill é cruzada.',
    },
    {
      eyebrow: 'WMD',
      title: 'Armas de destruição em massa',
      description:
        'O potencial de dano excede a lógica de risco individual ordinário. Aqui a restrição não protege sensibilidade; protege vidas em escala.',
    },
  ] satisfies SiteCard[],
  openSourceLinks: [
    {
      href: 'https://github.com/Kyns-ai/kyns',
      label: 'Kyns-ai/kyns',
      description: 'Repositório público do KYNS — contribua, reporte bugs ou faça seu próprio fork.',
    },
    {
      href: 'https://github.com/danny-avila/LibreChat',
      label: 'Base LibreChat',
      description: 'Base open-source sobre a qual a experiência KYNS foi construída e adaptada.',
    },
  ],
} as const;

export const faqCategories: FAQCategory[] = [
  {
    title: 'Geral',
    items: [
      {
        question: 'O que é o KYNS?',
        answer:
          'KYNS é IA privada e sem censura. Uma ferramenta de liberdade intelectual, acesso ao conhecimento e privacidade real, com limites baseados em dano direto.',
      },
      {
        question: 'Como ele é diferente de ChatGPT ou Claude?',
        answer:
          'A diferença central é de postura: menos paternalismo, menos restrição corporativa, mais transparência. Conversas são deletadas automaticamente após 24h e nunca usadas para treino.',
      },
      {
        question: 'O KYNS é gratuito?',
        answer:
          'Existe acesso gratuito com limites operacionais. Recursos, velocidade e cotas podem variar conforme o plano ativo e a capacidade da infraestrutura.',
      },
      {
        question: 'Preciso criar conta?',
        answer:
          'Alguns fluxos podem exigir conta para autenticação e gestão de uso, mas o desenho geral do produto busca reduzir coleta de dados ao mínimo necessário.',
      },
      {
        question: 'Em que idiomas funciona?',
        answer:
          'Os modelos operam em múltiplos idiomas. A experiência editorial do site é em português, mas o KYNS funciona em qualquer idioma que o usuário preferir.',
      },
    ],
  },
  {
    title: 'Privacidade',
    items: [
      {
        question: 'O KYNS armazena minhas conversas?',
        answer:
          'Por até 24 horas no servidor, para continuidade de sessão. Após esse prazo, são automaticamente e permanentemente deletadas. Nenhum histórico é retido além desse período.',
      },
      {
        question: 'O que acontece com minhas conversas depois de 24h?',
        answer:
          'São deletadas automaticamente do servidor. Não há como restaurar conversas após o prazo de deleção automática.',
      },
      {
        question: 'Vocês veem o que eu escrevo?',
        answer:
          'O conteúdo precisa ser processado operacionalmente para gerar resposta, mas a arquitetura evita transformá-lo em acervo persistente. Logs técnicos e conteúdo não são combinados como perfil de conversa.',
      },
      {
        question: 'E se o governo pedir meus dados?',
        answer:
          'Conversas são deletadas após 24h. Após esse prazo, não há histórico de conversa a entregar. Dados de conta (e-mail, dados técnicos) podem ser exigidos por ordem judicial.',
      },
      {
        question: 'Posso exportar minhas conversas?',
        answer:
          'Sim, enquanto a conversa existir (dentro do prazo de 24h). A interface permite exportar o histórico ativo.',
      },
    ],
  },
  {
    title: 'Conteúdo',
    items: [
      {
        question: 'O que “sem censura” significa?',
        answer:
          'Significa sem filtros corporativos que decidem o que você pode saber. Não significa ausência de regras: conteúdo que causa dano direto a outros continua bloqueado.',
      },
      {
        question: 'Vocês moderam conteúdo?',
        answer:
          'Existe uma camada mínima de regras de plataforma e filtros para impedir linhas objetivas de dano. Fora isso, o KYNS evita respostas moralistas e filtros expansivos.',
      },
      {
        question: 'Vocês treinam com meus dados?',
        answer:
          'Não. O KYNS não usa conversas, prompts, respostas ou imagens dos usuários para treinamento de modelos.',
      },
    ],
  },
  {
    title: 'Técnico',
    items: [
      {
        question: 'Quais modelos vocês usam?',
        answer:
          'Hoje o núcleo textual gira em torno do `llmfan46/Qwen3.5-27B-heretic-v2`, com perfis separados para KYNS e KYNS Deep, além de uma stack própria para imagem.',
      },
      {
        question: 'O código é open source?',
        answer:
          'A base tecnológica utilizada pelo produto é aberta, e a página de Transparência aponta os repositórios públicos relevantes para site/config e stack base.',
      },
    ],
  },
];

export const contactContent = {
  eyebrow: 'CONTATO',
  title: 'Um canal para tudo.',
  description:
    'Suporte geral, copyright, privacidade, abuso, dúvidas sobre cobrança ou política: tudo passa pelo mesmo e-mail operacional para reduzir fricção e manter a resposta centralizada.',
  emailLabel: 'contact@kyns.ai',
  supportCards: [
    {
      eyebrow: 'GERAL',
      title: 'Dúvidas sobre produto e conta',
      description: 'Problemas de acesso, assinatura, fluxo do site ou questões gerais de uso da plataforma.',
    },
    {
      eyebrow: 'LEGAL',
      title: 'Copyright, notificações e privacidade',
      description: 'Reclamações de copyright, solicitações de dados e comunicações jurídicas ou regulatórias.',
    },
    {
      eyebrow: 'ABUSO',
      title: 'Relatos de uso indevido',
      description: 'Se você identificar comportamento que viole nossas políticas, envie contexto suficiente para análise.',
    },
  ] satisfies SiteCard[],
} as const;

export const legalPages = {
  terms: {
    title: 'Termos de Uso',
    eyebrow: 'LEGAL',
    updatedLabel: 'Última atualização: março de 2026',
    markdown: termsMarkdown,
    meta: pageMeta.terms,
  },
  privacy: {
    title: 'Política de Privacidade',
    eyebrow: 'LEGAL',
    updatedLabel: 'Vigência: março de 2026',
    markdown: privacyMarkdown,
    meta: pageMeta.privacy,
  },
  contentPolicy: {
    title: 'Política de Conteúdo',
    eyebrow: 'LEGAL',
    updatedLabel: 'Última atualização: março de 2026',
    markdown: contentPolicyMarkdown,
    meta: pageMeta.contentPolicy,
  },
  acceptableUse: {
    title: 'Política de Uso Aceitável',
    eyebrow: 'LEGAL',
    updatedLabel: 'Última atualização: março de 2026',
    markdown: acceptableUseMarkdown,
    meta: pageMeta.acceptableUse,
  },
} as const;

export type LegalPageKey = keyof typeof legalPages;
