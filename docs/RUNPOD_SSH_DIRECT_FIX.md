# Corrigir SSH directo ao RunPod (Connection refused)

O **proxy** (`ssh ...@ssh.runpod.io`) abre sessão no pod sem precisar de servidor SSH dentro do contentor. O **SSH over exposed TCP** (IP:porta) precisa de um **sshd a correr dentro do pod**. "Connection refused" significa que nada está à escuta nessa porta — normalmente o sshd não está instalado ou não foi iniciado.

Seguindo estes passos, o direct TCP fica a funcionar e o Cursor Remote-SSH consegue ligar ao pod.

---

## 1. Expor a porta 22 no RunPod

1. Abre [RunPod Console → Pods](https://www.console.runpod.io/pods).
2. Clica no teu pod → menu (três riscas) → **Edit Pod** (ou **Edit Template** se fores alterar o template).
3. Em **Expose TCP Ports** adiciona `22` (e guarda).
4. Se o pod já tiver sido criado, anota o **Direct TCP** que aparece no separador **Connect**, por exemplo: `154.54.102.38:14252 → :22`.

---

## 2. Entrar no pod pelo proxy

No terminal do teu Mac:

```bash
ssh 5u3pybk1k08oav-64412075@ssh.runpod.io -i ~/.ssh/id_ed25519
```

Quando estiveres com o prompt `root@...:/#`, continua com o passo 3.

---

## 3. Instalar e iniciar SSH dentro do pod

Cola e executa **tudo de uma vez** no terminal do RunPod (sessão via proxy). Isto instala o servidor SSH, cria `~/.ssh/authorized_keys` e inicia o `sshd`. A primeira linha usa a chave que o RunPod pode injectar; se falhar, o script pede para colares a tua chave pública.

```bash
export RUNPOD_KEY="${SSH_PUBLIC_KEY:-$PUBLIC_KEY}"
if [ -z "$RUNPOD_KEY" ]; then
  echo "Variável PUBLIC_KEY/SSH_PUBLIC_KEY não definida."
  echo "Copia o conteúdo de: cat ~/.ssh/id_ed25519.pub (no teu Mac) e cola aqui quando pedido."
  read -r -p "Cola a tua chave pública SSH: " RUNPOD_KEY
fi
apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq openssh-server > /dev/null
mkdir -p /root/.ssh
chmod 700 /root/.ssh
echo "$RUNPOD_KEY" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
service ssh start
echo "SSH iniciado. Testa no Mac: ssh root@<POD_IP> -p <PORT> -i ~/.ssh/id_ed25519"
```

Se o RunPod não tiver injectado a chave e o `read` não funcionar (sessão não interactiva), faz à mão no pod:

```bash
apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y openssh-server
mkdir -p /root/.ssh && chmod 700 /root/.ssh
echo "COLA_AQUI_TUA_CHAVE_PUBLICA" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
service ssh start
```

(Substitui `COLA_AQUI_TUA_CHAVE_PUBLICA` pelo output de `cat ~/.ssh/id_ed25519.pub` no teu Mac.)

---

## 4. Testar SSH directo no Mac

No **Mac**, com o IP e porta do passo 1 (ex.: 154.54.102.38 e 14252):

```bash
ssh root@154.54.102.38 -p 14252 -i ~/.ssh/id_ed25519
```

Se entrar sem "Connection refused", está resolvido.

---

## 5. Cursor Remote-SSH

No Cursor: **Command Palette** → **Remote-SSH: Connect to Host** → escolhe **runpod** (ou o host que tiveres em `~/.ssh/config` com esse `HostName` e `Port`). Depois **Open Folder** e trabalhas no pod; os comandos do assistente passam a correr no RunPod.

---

## Notas

- **Template custom:** Para o SSH directo sobreviver a reinícios do pod, o template deve expor a porta 22 e incluir o arranque do sshd (ver [RunPod – Use SSH](https://docs.runpod.io/pods/configuration/use-ssh)).
- **Chave no RunPod:** Em [User Settings → SSH Public Keys](https://www.console.runpod.io/user/settings) podes adicionar a chave; em alguns templates ela é injectada como `PUBLIC_KEY` ou `SSH_PUBLIC_KEY`.
- Se continuar "Connection refused", confirma no pod que o sshd está a correr: `service ssh status` (dentro da sessão proxy).
