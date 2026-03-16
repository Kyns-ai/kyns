# Política de Privacidade

Última atualização: março de 2026

No KYNS, privacidade não é discurso de marketing. É uma escolha de arquitetura.

Esta Política de Privacidade descreve como coletamos, usamos e divulgamos informações quando você acessa nossa plataforma, recursos e serviços relacionados (em conjunto, os "Serviços").

## 1. Arquitetura de privacidade

O KYNS foi projetado para minimizar a retenção de dados. Nossa abordagem:

- O conteúdo das conversas (mensagens e respostas da IA) é retido por **até 24 horas** para continuidade de sessão, depois **automaticamente e permanentemente deletado** dos nossos servidores;
- Imagens geradas são retidas por **até 24 horas** para entrega, depois automaticamente deletadas;
- Após a janela de 24 horas, o conteúdo das conversas e as imagens **não podem ser recuperados por ninguém**, incluindo o KYNS;
- Não treinamos modelos de IA com as conversas dos usuários;
- Não usamos o conteúdo das conversas para analytics, publicidade, perfilamento ou qualquer finalidade secundária;
- Informações de identificação do usuário (e-mail, ID de usuário, endereço IP) **não são incluídas** nas requisições enviadas à camada de inferência do modelo de IA. O provedor do modelo recebe apenas o conteúdo da conversa e os parâmetros do modelo.

## 2. Informações pessoais que coletamos

### 2.1 Informações de conta

Quando você cria uma conta, coletamos:

- Endereço de e-mail (para criação de conta, login e recuperação de senha);
- Senha em hash (bcrypt — nunca armazenamos senhas em texto simples);
- Avatar (preferência do usuário);
- Data de criação da conta e timestamp do último acesso.

### 2.2 Informações coletadas automaticamente

- **Log Data:** endereço IP, tipo de navegador, configurações, data e hora das requisições e como você interage com os Serviços. IPs são usados para limitação de taxa e prevenção de abuso;
- **Usage Data:** recursos utilizados, ações executadas (como criar conversas, fazer login), fuso horário, país, datas e horários de acesso;
- **Device Information:** nome do dispositivo, sistema operacional, tipo de navegador.

### 2.3 Memórias personalizadas

A plataforma inclui um recurso opcional de memória que armazena preferências e contexto personalizados para melhorar a qualidade das respostas. As memórias são:

- Retidas indefinidamente até que o usuário as delete ou desative o recurso;
- Armazenadas nos nossos servidores;
- Controláveis pelo usuário: você pode desativar o sistema de memória inteiramente em **Configurações → Personalização**, deletar memórias específicas ou deletar todas as memórias a qualquer momento.

### 2.4 Informações de comunicação

Se você entrar em contato conosco, podemos coletar nome, informações de contato e o conteúdo das mensagens enviadas.

### 2.5 O que não coletamos

- Conteúdo de conversas além da janela de retenção de 24 horas;
- Perfis comportamentais, gráficos de interesse ou rastreamento entre sessões;
- Fingerprints de dispositivo além de cabeçalhos HTTP padrão;
- Números de cartão de crédito ou dados financeiros (processados integralmente pelo Stripe);
- Dados biométricos de qualquer natureza.

## 3. Como usamos as informações pessoais

- Para fornecer, administrar, manter e analisar os Serviços;
- Para autenticar seu acesso e manter sua conta;
- Para enviar comunicações transacionais (redefinição de senha, notificações de segurança);
- Para prevenir fraude, atividade criminosa ou uso indevido dos Serviços;
- Para aplicar limitações de taxa e prevenir abuso;
- Para cumprir obrigações legais;
- Para melhorar os Serviços usando métricas agregadas e não identificáveis.

Não usamos suas informações para publicidade direcionada, venda a corretores de dados, treinamento de modelos de IA, análise comportamental ou perfilamento.

## 4. Processamento pelo modelo de IA

Quando você envia uma mensagem no KYNS:

- Sua entrada é recebida pelo servidor backend da plataforma via conexão criptografada;
- Informações de identificação (e-mail, ID de usuário, endereço IP) **não são incluídas** na requisição enviada ao servidor do modelo. A requisição contém apenas o conteúdo da conversa e os parâmetros do modelo;
- Cada requisição é processada em uma sessão de inferência isolada pela IA em infraestrutura de GPU de terceiros;
- O provedor de infraestrutura processa a requisição sem acesso à identidade do usuário — a requisição se origina do IP do servidor do KYNS, não do IP do usuário;
- A resposta é transmitida de volta à plataforma e entregue ao seu navegador;
- A conversa é retida no banco de dados da plataforma por até 24 horas para continuidade de sessão, depois permanentemente deletada.

Os modelos de IA são open-source (atualmente Qwen, desenvolvido pela Alibaba Cloud). O KYNS não desenvolve nem treina os modelos principais. A infraestrutura de GPU é fornecida por um provedor terceirizado.

## 5. Cookies

A plataforma KYNS usa cookies mínimos:

- Cookie de autenticação de sessão (token JWT) — estritamente necessário;
- Token de proteção CSRF — estritamente necessário.

Não usamos cookies de analytics, cookies de publicidade, pixels de rastreamento, widgets de redes sociais ou cookies de terceiros.

## 6. Compartilhamento e divulgação

Podemos compartilhar informações pessoais apenas nas seguintes circunstâncias:

- **Fornecedores e prestadores de serviço:** hospedagem, nuvem, e-mail, pagamento e outros provedores que processam informações conforme nossas instruções. Esses provedores nunca recebem conteúdo de conversa além do necessário para operação do serviço;
- **Transferências de negócio:** se o KYNS estiver envolvido em uma transação estratégica, reorganização ou transferência de serviço, informações pessoais podem ser transferidas como parte da operação;
- **Exigências legais:** podemos compartilhar informações com autoridades governamentais se exigido por lei, para proteger nossos direitos ou propriedade, para tratar violações dos nossos termos, para proteger a segurança ou para proteger contra responsabilidade legal.

Não vendemos nem compartilhamos informações pessoais para publicidade comportamental entre contextos.

## 7. Seus direitos

Dependendo da sua localização, você pode ter certos direitos legais em relação às suas informações pessoais, incluindo o direito de:

- Acessar suas informações pessoais e como elas são processadas;
- Deletar suas informações pessoais dos nossos registros;
- Corrigir ou atualizar suas informações pessoais;
- Transferir suas informações pessoais a terceiros (portabilidade de dados);
- Restringir como processamos suas informações pessoais;
- Retirar consentimento quando aplicável;
- Opor-se a como processamos suas informações pessoais;
- Registrar reclamação junto à sua autoridade local de proteção de dados.

Para exercer qualquer desses direitos, envie sua solicitação para `privacy@kyns.ai`.

**Nota:** o conteúdo de conversas com mais de 24 horas não pode ser acessado, corrigido ou deletado porque já foi permanentemente removido dos nossos sistemas. Memórias personalizadas podem ser visualizadas, editadas e deletadas pelo usuário a qualquer momento pela interface da plataforma.

## 8. Crianças

A plataforma é restrita a usuários com 18 anos ou mais. Não coletamos intencionalmente informações pessoais de menores de 18 anos. Se tomarmos conhecimento de que um usuário tem menos de 18 anos, encerraremos imediatamente a conta e deletaremos todos os dados associados. Entre em contato com `safety@kyns.ai` para reportar um menor usando a plataforma.

## 9. Segurança e retenção

Implementamos medidas comercialmente razoáveis para proteger informações pessoais:

- Conexões criptografadas (TLS) para todos os dados em trânsito;
- Proteção DDoS e Web Application Firewall;
- Limitação de taxa e aplicação de CORS;
- Hash de senha com bcrypt;
- Dados de identificação do usuário excluídos das requisições ao modelo de IA.

**Períodos de retenção:**

- Conteúdo de conversas e imagens: máximo 24 horas, depois permanentemente deletados;
- Memórias personalizadas: retidas até que o usuário as delete ou desative o recurso;
- Endereços IP: usados para limitação de taxa durante a sessão, não retidos em logs dedicados;
- Informações de conta: retidas enquanto sua conta estiver ativa;
- Após exclusão da conta: todos os dados permanentemente removidos em até 30 dias.

## 10. Usuários internacionais

Ao usar nossos Serviços, você entende e reconhece que suas informações pessoais serão processadas em nossas instalações e servidores nos Estados Unidos e podem ser divulgadas a nossos prestadores de serviço em outras jurisdições.

## 11. Alterações nesta Política

Podemos atualizar esta Política de Privacidade periodicamente. Alterações materiais receberão aviso de pelo menos 30 dias via e-mail ou notificação na plataforma. Se não concordar, você deve parar de usar os Serviços.

## 12. Contato

- Questões de privacidade: `privacy@kyns.ai`
- Segurança de menores: `safety@kyns.ai`

**KYNS LLC** — Registrada no Estado de Delaware, Estados Unidos.
