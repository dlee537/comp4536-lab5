require('dotenv').config();
const http = require("http");
const url = require("url");
const mysql = require("mysql2");

class Database {
  constructor(config) {
    this.connection = mysql.createConnection(config);
    this.connect();
  }

  connect() {
    this.connection.connect(err => {
      if (err) {
        console.error("Database connection failed:", err.message);
        throw err;
      }
      console.log("Database connected successfully");
    });
  }

  query(sql, callback) {
    this.connection.query(sql, callback);
  }

  isSafeQuery(query) {
    return !/(DROP|UPDATE|DELETE)/i.test(query);
  }
}

class ResponseHelper {
  static sendJSON(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }

  static setCORS(res, origin = "*") {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

class ApiServer {
  constructor(port, dbConfig, basePath = "/api") {
    this.port = port;
    this.db = new Database(dbConfig);

    this.basePath = (basePath || "/api").replace(/\/$/, "");
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  start() {
    this.server.listen(this.port, () =>
      console.log(`Server running on port ${this.port}`)
    );
  }

  handleRequest(req, res) {
    ResponseHelper.setCORS(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedURL = url.parse(req.url, true);
    const path = (parsedURL.pathname || "").replace(/\/$/, "");
    const method = req.method;

    const relativePath = path.startsWith(this.basePath)
      ? path.slice(this.basePath.length) || "/"
      : path;

    if (relativePath === "/sql") {
      if (method === "GET") return this.handleGetSQL(parsedURL, res);
      if (method === "POST") return this.handlePostSQL(req, res);
    } else {
      ResponseHelper.sendJSON(res, 404, { error: "Route not found" });
    }
  }

  handleGetSQL(parsedURL, res) {
    const query = parsedURL.query.q;
    if (!query)
      return ResponseHelper.sendJSON(res, 400, { error: "Missing query parameter 'q'" });

    if (!this.db.isSafeQuery(query))
      return ResponseHelper.sendJSON(res, 403, { error: "Forbidden SQL operation" });

    this.db.query(query, (err, results) => {
      if (err)
        return ResponseHelper.sendJSON(res, 400, { error: err.message });

      ResponseHelper.sendJSON(res, 200, { data: results });
    });
  }

  handlePostSQL(req, res) {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      try {
        const { query } = JSON.parse(body);
        if (!query)
          return ResponseHelper.sendJSON(res, 400, { error: "Missing 'query' in request body" });

        if (!this.db.isSafeQuery(query))
          return ResponseHelper.sendJSON(res, 403, { error: "Forbidden SQL operation" });

        this.db.query(query, (err, result) => {
          if (err)
            return ResponseHelper.sendJSON(res, 400, { error: err.message });

          ResponseHelper.sendJSON(res, 201, {
            message: "Query executed successfully",
            affectedRows: result.affectedRows,
            insertId: result.insertId,
          });
        });
      } catch (err) {
        return ResponseHelper.sendJSON(res, 400, { error: "Invalid JSON format" });
      }
    });
  }
}

const server = new ApiServer(
  process.env.PORT,
  {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
  },
  process.env.BASE_PATH
);

server.start();