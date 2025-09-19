# CRUD API Node.js avec MariaDB et Nginx

## Description
API CRUD conteneurisée pour la gestion des utilisateurs. Production-ready avec logs structurés JSON, endpoint de monitoring et configuration via variables d'environnement.  

---

## 1. Variables d’environnement nécessaires

| Variable      | Description                                  | Exemple         |
|---------------|---------------------------------------------|----------------|
| `DB_HOST`     | Hôte de la base de données                  | `db`           |
| `DB_USER`     | Nom d’utilisateur de la base de données    | `root`         |
| `DB_PASSWORD` | Mot de passe de l’utilisateur DB            | `root`         |
| `DB_NAME`     | Nom de la base de données                   | `crud_app`     |
| `DB_PORT`     | Port de connexion à la base                 | `3306`         |
| `LOG_DIR`     | Dossier de stockage des logs                | `/var/logs/crud` |

> Ces variables sont déjà définies dans le **docker-compose.yml**.

---

## 2. Instructions de démarrage

### Pré-requis
- Docker et Docker Compose installés.

### Démarrage
1. Dézipper le projet et aller dans le dossier :  
```bash
cd crud-api
docker-compose up --build
```

## 3. Commandes à tester

1. Health de l’API :
```bash
curl http://localhost:3000/health
```

2. Liste des utilisateurs :
```bash
curl http://localhost:3000/api/users
```

3. Créer un utilisateur :
```bash
curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{"fullname":"Alice Dupont","study_level":"Master","age":25}'
```

3. Récupérer un utilisateur par UUID :
```bash
curl http://localhost:3000/api/users/<UUID>
```

4. Mettre à jour un utilisateur :
```bash
curl -X PUT http://localhost:3000/api/users/<UUID> -H "Content-Type: application/json" -d '{"fullname":"Alice Martin","study_level":"Doctorat","age":27}'
```

5. Supprimer un utilisateur :
```bash
curl -X DELETE http://localhost:3000/api/users/<UUID>
```

## 4. Logs

1. app.log       : Logs applicatifs (INFO, WARN, ERROR)

2. access.log    : Logs d’accès Nginx au format JSON

3. error.log     : Logs d’erreur Nginx
