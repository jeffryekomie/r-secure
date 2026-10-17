# Serveur VPN — mise en place

## 1. Initialiser le serveur (une seule fois)

```bash
cd backend/vpn
docker volume create --name openvpn-data
docker run -v $PWD/openvpn-data:/etc/openvpn --rm kylemanna/openvpn ovpn_genconfig -u udp://VOTRE_IP_OU_DOMAINE_SERVEUR
docker run -v $PWD/openvpn-data:/etc/openvpn --rm -it kylemanna/openvpn ovpn_initpki
docker compose up -d
```

## 2. Créer un profil VPN pour chaque routeur vendu

```bash
docker run -v $PWD/openvpn-data:/etc/openvpn --rm -it kylemanna/openvpn easyrsa build-client-full routeur-nadege-01 nopass
docker run -v $PWD/openvpn-data:/etc/openvpn --rm kylemanna/openvpn ovpn_getclient routeur-nadege-01 > routeur-nadege-01.ovpn
```

Importez le fichier `.ovpn` dans le menu **VPN Client** du W154R Plus (confirmé présent : 192.168.1.1 → Avancé → VPN → VPN Client → OpenVPN).

## 3. Attribuer une IP fixe au routeur dans le tunnel

```bash
mkdir -p openvpn-data/ccd
echo "ifconfig-push 10.8.0.14 255.255.255.0" > openvpn-data/ccd/routeur-nadege-01
```

Enregistrez ensuite ce routeur dans RTL Connect via `POST /routers` avec `vpn_ip: "10.8.0.14"`.

## 4. Vérifier la connexion

```bash
ping 10.8.0.14
curl http://10.8.0.14
```
