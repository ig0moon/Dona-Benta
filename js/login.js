// ============================================
// DONA BENTA — js/login.js
// Autenticação: Login, Cadastro e Recuperação de Senha
// ============================================

const abaEntrar = document.getElementById('abaEntrar');
const abaCadastrar = document.getElementById('abaCadastrar');
const formEntrar = document.getElementById('formEntrar');
const formCadastrar = document.getElementById('formCadastrar');

if (abaEntrar && abaCadastrar) {
  abaEntrar.addEventListener('click', () => {
    abaEntrar.classList.add('ativa');
    abaCadastrar.classList.remove('ativa');
    formEntrar.classList.add('ativo');
    formCadastrar.classList.remove('ativo');
  });

  abaCadastrar.addEventListener('click', () => {
    abaCadastrar.classList.add('ativa');
    abaEntrar.classList.remove('ativa');
    formCadastrar.classList.add('ativo');
    formEntrar.classList.remove('ativo');
  });
}

// Redireciona se já estiver autenticado
(async () => {
  try {
    const usuario = await usuarioAtual();
    if (usuario) {
      const perfil = await perfilAtual();
      if (perfil?.role === 'admin') {
        window.location.href = 'conta.html?aba=admin';
      } else {
        window.location.href = 'conta.html';
      }
    }
  } catch (e) {
    console.warn('Verificação de sessão no login:', e);
  }
})();

// Form de Login
formEntrar?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnEntrar');
  const emailInput = document.getElementById('emailEntrar');
  const senhaInput = document.getElementById('senhaEntrar');

  const email = emailInput.value.trim();
  const senha = senhaInput.value;

  if (!email || !senha) {
    mostrarToast('Preencha seu e-mail e senha.', 'alerta');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined spin">autorenew</span> Entrando...';

  const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
  btn.disabled = false;
  btn.textContent = 'Entrar';

  if (error) {
    mostrarToast('E-mail ou senha incorretos.', 'erro');
    return;
  }

  mostrarToast('Login realizado com sucesso!', 'sucesso');
  const perfil = await perfilAtual();
  setTimeout(() => {
    if (perfil?.role === 'admin') {
      window.location.href = 'conta.html?aba=admin';
    } else {
      window.location.href = 'conta.html';
    }
  }, 600);
});

// Form de Cadastro
formCadastrar?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnCadastrar');
  const nome = document.getElementById('nomeCadastro').value.trim();
  const telefone = document.getElementById('telefoneCadastro').value.trim();
  const email = document.getElementById('emailCadastro').value.trim();
  const senha = document.getElementById('senhaCadastro').value;

  if (!nome || !telefone || !email || !senha) {
    mostrarToast('Preencha todos os campos para criar a conta.', 'alerta');
    return;
  }

  if (senha.length < 6) {
    mostrarToast('A senha deve ter pelo menos 6 caracteres.', 'alerta');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined spin">autorenew</span> Criando conta...';

  const { data, error } = await db.auth.signUp({
    email,
    password: senha,
    options: {
      data: {
        nome,
        telefone
      }
    }
  });

  if (error) {
    mostrarToast(error.message || 'Erro ao criar conta.', 'erro');
    btn.disabled = false;
    btn.textContent = 'Criar conta';
    return;
  }

  if (data.user) {
    try {
      await db.from('perfis').upsert({
        id: data.user.id,
        nome,
        telefone,
        role: 'cliente'
      });
    } catch (errPerfil) {
      console.warn('Aviso: inserção inicial em perfis:', errPerfil);
    }
  }

  btn.disabled = false;
  btn.textContent = 'Criar conta';
  mostrarToast('Conta criada com sucesso! Redirecionando...', 'sucesso');
  setTimeout(() => {
    window.location.href = 'conta.html';
  }, 900);
});

// Esqueci minha senha
document.getElementById('linkEsqueciSenha')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const emailInput = document.getElementById('emailEntrar');
  const email = emailInput?.value?.trim();

  if (!email) {
    mostrarToast('Digite seu e-mail no campo acima antes de solicitar recuperação.', 'alerta');
    emailInput?.focus();
    return;
  }

  const { error } = await db.auth.resetPasswordForEmail(email);
  if (error) {
    mostrarToast('Erro ao enviar e-mail de recuperação: ' + error.message, 'erro');
  } else {
    mostrarToast('E-mail de recuperação enviado! Verifique sua caixa de entrada.', 'sucesso');
  }
});