<?= $this->extend('layouts/main') ?>

<?= $this->section('content') ?>
  <section class="pagina-header">
    <div class="container">
      <span class="eyebrow">Transparência</span>
      <h1>Política de Privacidade</h1>
      <p>Como cuidamos dos seus dados, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).</p>
    </div>
  </section>

  <main class="secao">
    <div class="container texto-legal" style="max-width: 760px; line-height: 1.7;">
      <h2>1. Quem é responsável pelos seus dados</h2>
      <p>
        A <?= esc($loja->nomeFantasia) ?><?= $loja->razaoSocial !== '' ? ' (' . esc($loja->razaoSocial) . ')' : '' ?><?= $loja->cnpj !== '' ? ', CNPJ ' . esc($loja->cnpj) : '' ?>,
        com endereço na <?= esc($loja->endereco) ?>, é a controladora dos dados pessoais tratados neste site.
      </p>
      <p>
        <strong>Canal de privacidade (encarregado):</strong> para qualquer assunto sobre seus dados, chame no WhatsApp <?= esc($loja->whatsapp) ?><?php if ($loja->email !== ''): ?> ou escreva para
        <a href="mailto:<?= esc($loja->email, 'attr') ?>"><?= esc($loja->email) ?></a><?php endif ?>.
      </p>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li><strong>Cadastro:</strong> nome, e-mail, telefone/WhatsApp e senha. A senha é guardada apenas de forma criptografada (hash) e nem nós conseguimos lê-la.</li>
        <li><strong>Perfil (opcional):</strong> endereço de entrega (CEP, bairro, rua, número e complemento) e foto de perfil.</li>
        <li><strong>Pedidos:</strong> produtos, valores, data e horário agendados, forma de entrega, endereço de entrega, observações, forma de pagamento e situação do pedido.</li>
        <li><strong>Pagamento por Pix:</strong> o CPF que você digita é enviado diretamente ao Mercado Pago para emitir o QR Code, como exige o Banco Central. Nós não guardamos o seu CPF.</li>
        <li><strong>Pagamento por cartão:</strong> os dados do cartão são digitados no ambiente do Mercado Pago e não passam pelos nossos servidores.</li>
        <li><strong>Registros de acesso:</strong> data, hora e endereço IP de cada login e cadastro, que a lei nos obriga a guardar (Marco Civil da Internet, art. 15).</li>
      </ul>
      <p>Não coletamos dados sensíveis (como saúde, religião ou biometria). Se você escrever alguma informação de saúde nas observações do pedido (por exemplo, uma alergia), ela será usada só para preparar o seu pedido.</p>

      <h2>3. Para que usamos e com qual base legal</h2>
      <ul>
        <li><strong>Criar e manter sua conta, receber, preparar, entregar e cobrar seus pedidos e falar com você sobre eles</strong> — execução do contrato de compra (LGPD, art. 7º, V).</li>
        <li><strong>Guardar pedidos e documentos fiscais e os registros de acesso</strong> — cumprimento de obrigação legal (art. 7º, II).</li>
        <li><strong>Proteger o site e a sua conta contra fraudes e abusos</strong> (limite de tentativas, verificação de pagamentos) — legítimo interesse (art. 7º, IX) e prevenção à fraude.</li>
        <li><strong>Defender direitos em eventual processo</strong> — exercício regular de direitos (art. 7º, VI).</li>
      </ul>
      <p>Não vendemos seus dados, não enviamos propaganda sem o seu pedido e não tomamos decisões automatizadas sobre você.</p>

      <h2>4. Com quem compartilhamos</h2>
      <p>Somente com quem é necessário para o site funcionar, e cada um só recebe o que precisa:</p>
      <ul>
        <li><strong>Mercado Pago:</strong> processa os pagamentos (recebe nome, e-mail, valor e, no Pix, o CPF).</li>
        <li><strong>Render:</strong> hospeda o site.</li>
        <li><strong>TiDB Cloud (PingCAP):</strong> guarda o banco de dados da loja.</li>
        <li><strong>Google Fonts:</strong> fornece os ícones do site; ao carregá-los, seu navegador informa o endereço IP ao Google.</li>
        <li><strong>WhatsApp (Meta):</strong> só quando você mesmo clica em um botão de WhatsApp para falar com a gente.</li>
        <li><strong>Autoridades:</strong> quando houver ordem judicial ou obrigação legal.</li>
      </ul>

      <h2>5. Transferência para fora do Brasil</h2>
      <p>Os serviços de hospedagem e de banco de dados podem guardar os dados em servidores fora do Brasil. Essa transferência acontece para executar o contrato com você (LGPD, art. 33, IX, combinado com o art. 7º, V) e com provedores que adotam padrões de segurança reconhecidos internacionalmente.</p>

      <h2>6. Por quanto tempo guardamos</h2>
      <ul>
        <li><strong>Conta e perfil:</strong> enquanto a conta existir. Ao excluir a conta, eles são apagados.</li>
        <li><strong>Foto de perfil:</strong> quando você troca ou remove a foto, a anterior é apagada.</li>
        <li><strong>Pedidos pagos ou concluídos:</strong> por 5 anos, para obrigações fiscais e de defesa do consumidor. Se você excluir a conta, eles ficam sem endereço e observações. Pedidos não pagos são apagados junto com a conta.</li>
        <li><strong>Registros de acesso:</strong> 6 meses, como exige o Marco Civil da Internet. Depois disso, são apagados automaticamente.</li>
      </ul>

      <h2>7. Como protegemos</h2>
      <p>Conexão criptografada (HTTPS), senhas guardadas com criptografia de mão única, banco de dados com conexão criptografada, acesso aos pedidos restrito ao próprio cliente e à equipe da loja, e limite de tentativas de login. Se acontecer um incidente de segurança que possa trazer risco a você, vamos avisar você e a Autoridade Nacional de Proteção de Dados (ANPD), como manda a lei.</p>

      <h2>8. Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode a qualquer momento: confirmar se tratamos seus dados; acessá-los; corrigir dados incompletos ou errados; pedir anonimização, bloqueio ou eliminação do que for desnecessário; pedir a portabilidade; saber com quem compartilhamos; ser informado sobre a possibilidade de não dar consentimento e suas consequências, e revogar um consentimento já dado; e se opor a tratamentos irregulares.</p>
      <p><strong>Direto pelo site, em <a href="conta">Minha conta → Meus dados</a>:</strong></p>
      <ul>
        <li>editar seus dados e seu endereço;</li>
        <li>baixar uma cópia de todos os seus dados e pedidos (<em>Baixar meus dados</em>);</li>
        <li>excluir sua conta (<em>Excluir minha conta</em>).</li>
      </ul>
      <p>Para outros pedidos, fale com a gente pelo WhatsApp <?= esc($loja->whatsapp) ?><?php if ($loja->email !== ''): ?> ou pelo e-mail <a href="mailto:<?= esc($loja->email, 'attr') ?>"><?= esc($loja->email) ?></a><?php endif ?>. Respondemos em até 15 dias. Você também pode reclamar na ANPD (<a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">gov.br/anpd</a>).</p>

      <h2>9. Cookies e armazenamento no navegador</h2>
      <p>Usamos apenas o cookie essencial de sessão (<code>ci_session</code>), que mantém você conectado e protege sua conta, e o armazenamento do navegador para guardar o carrinho, o tema (claro/escuro) que você escolheu e o fechamento do aviso de cookies. Não usamos cookies de publicidade nem ferramentas de rastreamento ou de análise de visitas.</p>

      <h2>10. Crianças e adolescentes</h2>
      <p>O site é destinado a maiores de 18 anos. Menores devem fazer pedidos com um responsável.</p>

      <h2>11. Mudanças nesta política</h2>
      <p>Se esta política mudar, a data abaixo será atualizada. Mudanças importantes serão avisadas no site.</p>

      <p style="margin-top: 24px;">Veja também os <a href="termos">Termos e Condições de compra</a>.</p>
      <p style="color: var(--marrom-claro); margin-top: 32px;">Última atualização: 17 de novembro de 2026.</p>
    </div>
  </main>
<?= $this->endSection() ?>
