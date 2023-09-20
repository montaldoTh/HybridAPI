const express = require("express");
const multer = require("multer");
const app = express();
const cors = require("cors");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const secretKey = "your_secret_key";

  app.use(cors());

app.use(express.static("uploads"));

// Configuration de la base de données
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "todo",
});

// Middleware pour vérifier le token JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) {
    return res.sendStatus(401);
  }

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }

    req.user = user;
    next();
  });
}

// Connexion à la base de données
connection.connect((err) => {
  if (err) {
    console.error("Erreur de connexion à la base de données :", err);
    return;
  }
  console.log("Connecté à la base de données MySQL");
});

// Configuration du middleware pour le parsing du corps de la requête
app.use(express.json());

// Config stockage image 
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if(req.body.task){
      cb(null, "uploads/taks/");
    } else if(req.body.material){
      cb(null, "uploads/materials/");
    } else {
      cb(new Error('Aucun contexte valide (task ou material) fourni pour le téléchargement.'));
    }
  },
  filename: function (req, file, cb) {
    if(req.body.task){
      const task = JSON.parse(req.body.task);
      const extension = file.originalname.split(".").pop();
      const imageName = "image_task_" + task.title + "." + extension;
      req.imageName = imageName;
      cb(null, imageName);
    }
    if(req.body.material){
      const material = JSON.parse(req.body.material);
      const extension = file.originalname.split(".").pop();
      const imageName = "image_material_" + material.title + "." + extension;
      req.imageName = imageName;
      cb(null, imageName);
    }
  },
});
const upload = multer({ storage: storage }).single("photo");

// Lecteur Images
app.use('/uploads/tasks', express.static('./uploads/tasks'));
app.use('/uploads/materials', express.static('/uploads/materials'));

// ROUTES : 

  // Route all Materials
app.get("/materials", (req, res) => {
  connection.query("SELECT * FROM material ORDER BY id DESC", (err, results) => {
    if (err) {
      console.error("Erreur lors de la récupération des tasks :", err);
      res.status(500).send("Erreur serveur");
      return;
    }
    res.json(results);
  })
})

  // Route One Material by Id
app.get("/material/:id", (req, res) => {
  const matId = req.params.id;
  connection.query(
    "SELECT * FROM material WHERE id = ?", [matId],
    (err, results) => {
      if (err) {
        console.error("Erreur lors de la récupération de la remarque :", err);
        res.status(500).send("Erreur serveur");
        return;
      }
      if( res.length === 0){
        res.status(404).send("Matériel non trouvée")
        return;
      }
      res.json(results[0]);
    })
})

  // Route Create Material
app.post("/material", upload, (req, res) =>{
  const material = req.body.material

  if(req.imageName){
    material.image_name = req.imageName;
  }

  connection.query("INSERT INTO material SET ?", material, (err, result) => {
    if(err){
      console.error("Erreur lors de la création du matériel :", err)
      res.status(500).send("Erreur Serveur")
      return;
    }
    material.id = result.insertId;
    res.status(201).json(material)
  })
})

  // Route Update Material
app.put("/material/:id", upload, (req, res) => {
  console.log(req.body.material);
  const matId = req.params.id;
  const material = req.body.material

  if(req.imageName){
    material.photo = req.imageName;
  }

  connection.query(
    "UPDATE material SET ? WHERE id = ?", [material, matId], (err) => {
      if(err){
        console.error("Erreur lors de la mise a jour du matériel :", err)
        res.status(500).send("Erreur Serveur")
        return;
      }
      res.status(200).json(material)
    }
  )
})

  // Route Delete Material
app.delete("/material/:id", authenticateToken, (req, res) => {
  const matId = req.params.id;

  if(req.user.admin != 1){
    res.status(403);
    return;
  }

  connection.query("DELETE FROM material WHERE id = ?", [matId], (err) =>{
    if(err){
      console.error("Erreur lors de la suppression du matériel :", err);
      res.status(500).send("Erreur serveur");
      return;
    }
    res.sendStatus(204);
    return;
  })
})

  // Route pour récupérer tous les tasks
app.get("/tasks", (req, res) => {
  connection.query("SELECT * FROM task ORDER BY id DESC", (err, results) => {
    if (err) {
      console.error("Erreur lors de la récupération des tasks :", err);
      res.status(500).send("Erreur serveur");
      return;
    }
    res.json(results);
  });
});

  // Route pour récupérer un task par son ID
app.get("/task/:id", (req, res) => {
  const taskId = req.params.id;
  connection.query(
    "SELECT * FROM task WHERE id = ?",
    [taskId],
    (err, results) => {
      if (err) {
        console.error("Erreur lors de la récupération de la remarque :", err);
        res.status(500).send("Erreur serveur");
        return;
      }
      if (results.length === 0) {
        res.status(404).send("Remarque non trouvée");
        return;
      }
      res.json(results[0]);
    }
  );
});

  // Route pour créer un nouvel task
app.post("/task", upload, (req, res) => {

  const task = req.body.task;

  if (req.imageName) {
    task.image_name = req.imageName;
  }

  connection.query("INSERT INTO task SET ?", task, (err, result) => {
    if (err) {
      console.error("Erreur lors de la création de la remarque :", err);
      res.status(500).send("Erreur serveur");
      return;
    }
    task.id = result.insertId;
    res.status(201).json(task);
  });
});

  // Route pour mettre à jour un task
app.put("/task/:id", upload, (req, res) => {
  const taskId = req.params.id;
  const task = JSON.parse(req.body.task);

  if (req.imageName) {
    task.image_name = req.imageName;
  }

  connection.query("UPDATE task SET ? WHERE id = ?", [task, taskId], (err) => {
    if (err) {
      console.error("Erreur lors de la mise à jour de la remarque :", err);
      res.status(500).send("Erreur serveur");
      return;
    }
    //NOK -> res.sendStatus(200);
    res.status(200).json(task);
  });
});

  // Route pour supprimer un task
app.delete("/task/:id", authenticateToken, (req, res) => {
  const taskId = req.params.id;

  if (req.user.admin != 1) {
    res.sendStatus(403);
    return;
  }

  connection.query("DELETE FROM task WHERE id = ?", [taskId], (err) => {
    if (err) {
      console.error("Erreur lors de la suppression de la remarque :", err);
      res.status(500).send("Erreur serveur");
      return;
    }
    res.sendStatus(204);
    return;
  });
});

app.post("/login", (req, res) => {
  
  const { email, password } = req.body;

  // Vérifier si l'utilisateur existe dans la base de données
  connection.query(
    "SELECT * FROM user WHERE email = ?",
    [email],
    (err, results) => {
      if (err) {
        throw err;
      }

      if (results.length === 0) {
        return res.status(401).json({ message: "Adresse e-mail incorrecte" });
      }

      const user = results[0];

      // Vérifier le mot de passe
      bcrypt.compare(password, user.password, (bcryptErr, bcryptResult) => {
        if (bcryptErr || !bcryptResult) {
          return res.status(401).json({ message: "Mot de passe incorrect" });
        }

        // Générer un token JWT
        const token = jwt.sign(
          { email: user.email, admin: user.admin },
          secretKey,
          { expiresIn: "1d" } // Expiration du token
        );

        // Retourner le token JWT
        res.json({ token });
      });
    }
  );
});

// Point de terminaison pour l'inscription
app.post("/signup", (req, res) => {
  const { email, password, admin } = req.body;

  // Vérifier si l'utilisateur existe déjà dans la base de données
  connection.query(
    "SELECT * FROM user WHERE email = ?",
    [email],
    (err, results) => {
      if (err) {
        throw err;
      }

      if (results.length > 0) {
        return res.status(409).json({ message: "Cet utilisateur existe déjà" });
      }

      // Hasher le mot de passe avant de l'enregistrer dans la base de données
      bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
        if (hashErr) {
          throw hashErr;
        }

        // Insérer le nouvel utilisateur dans la base de données
        connection.query(
          "INSERT INTO user (email, password, admin) VALUES (?, ?, ?)",
          [email, hashedPassword, admin],
          (insertErr, insertResult) => {
            if (insertErr) {
              throw insertErr;
            }

            // Générer un token JWT pour l'utilisateur nouvellement inscrit
            const token = jwt.sign(
              { email, admin },
              secretKey,
              { expiresIn: "1d" } // Expiration du token
            );

            // Retourner le token JWT
            res.json({ token });
          }
        );
      });
    }
  );
});

const INSECURE_PORT = 3000;
app.listen(INSECURE_PORT, () => {
  console.log(`Server is running on insecure port ${INSECURE_PORT}.`);
});