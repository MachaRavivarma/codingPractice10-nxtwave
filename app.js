const express = require("express");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const dbpath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initilizeAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
initilizeAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "qwerty", async (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertStateObjectToResponsiveObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictObjectToResponsiveObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const sqlQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(sqlQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "qwerty");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticateToken, async (request, response) => {
  const sqlQuery = `SELECT * FROM state;`;
  const result = await db.all(sqlQuery);
  response.send(
    result.map((eachState) => convertStateObjectToResponsiveObject(eachState))
  );
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const sqlQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const result = await db.all(sqlQuery);
  response.send(convertStateObjectToResponsiveObject(eachState));
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const sqlQuery = `INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES district_name = '${districtName}',state_id = ${stateId}, cases = ${cases}, cured = ${cured}, active = ${active}, deaths =${deaths};`;
  const addQuery = await db.run(sqlQuery);
  const districtId = addQuery.lastId;
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const sqlQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const result = await db.get(sqlQuery);
    response.send(convertDistrictObjectToResponsiveObject(result));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const sqlQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    await db.get(sqlQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const sqlQuery = `UPDATE district
    SET district_name = '${districtName}',state_id = ${stateId}, cases = ${cases}, cured = ${cured}, active = ${active}, deaths =${deaths}
     WHERE district_id = ${districtId};`;
    await db.get(sqlQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "qwerty", async (error, user) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          const { stateId } = request.params;
          const sqlQuery = `
            SELECT SUM(cases) AS totalCases,
            SUM(cured) AS totalCured,
            SUM(active) AS totalActive,
            SUM(deaths) AS totalDeaths FROM state NATURAL JOIN district WHERE state_id = ${stateId};`;
          const result = await db.get(sqlQuery);
          response.send(result);
        }
      });
    }
  }
);
module.exports = app;
