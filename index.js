const express = require("express");
const axios = require("axios");
const app = express();
const cors = require("cors");
const connectDB = require("./connect");
const Auth = require("./authModel");
const dayjs = require("dayjs");

require("dotenv").config();

app.use(express.json());

app.use(cors());

connectDB();

const now = dayjs(); // current time

const generateTokenAndSaveTODB = async () => {
  console.log("Generating new token and saving to DB...");

  const params = new URLSearchParams();
  params.append("grant_type", "password");
  params.append("client_id", process.env.CLIENT_ID);
  params.append("client_secret", process.env.CLIENT_SECRET);
  params.append("username", process.env.TRAVELPORT_USERNAME);
  params.append("password", process.env.PASSWORD);
  params.append("scope", "openid");

  axios
    .post(
      "https://oauth.pp.travelport.com/oauth/oauth20/token",
      {
        grant_type: "password",
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        username: process.env.TRAVELPORT_USERNAME,
        password: process.env.PASSWORD,
        scope: "openid",
      },
      {
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    )
    .then(async (response) => {
      try {
        await Auth.findByIdAndUpdate(process.env.ID, {
          access_group: process.env.ACCESS_GROUP,
          token: response.data.access_token,
        });
      } catch (error) {
        console.log("Mongo Error:", error?.message);
      }
    })
    .catch((error) => console.log(error?.response?.data));
};

// axios
//   .post("https://oauth.pp.travelport.com/oauth/oauth20/token", params, {
//     headers: {
//       "Cache-Control": "no-cache",
//       "Content-Type": "application/x-www-form-urlencoded",
//     },
//   })
//   .then(async (response) => {
//     await Auth.create({
//       token: response.data.access_token,
//       access_group: process.env.ACCESS_GROUP,
//     });
//   })
//   .catch((error) => console.log(error.response.data));

setInterval(() => {
  console.log("Refreshing token...");

  generateTokenAndSaveTODB();
}, 24 * 60 * 60 * 1000); // 24 hours

let Token = "";
let Access_Group = "";

const fetchToken = async () => {
  try {
    const response = await Auth.find({});
    if (response.length > 0) {
      Token = response[0].token;
      Access_Group = response[0].access_group;
      const tokenDate = dayjs(response[0]?.updatedAt);

      // Calculate difference in hours
      const diffInHours = now.diff(tokenDate, "hour");
      console.log("Token is last Updated at:", response[0]?.updatedAt);

      if (diffInHours >= 24) {
        console.log("Token expired or 24 hours passed — run your function");
        generateTokenAndSaveTODB(); // 👈 replace with your logic
        fetchToken();
      } else {
        console.log(`Token still valid. ${24 - diffInHours} hours left.`);
      }
      console.log("Token and Access_Group fetched from DB");
    }

    return;
  } catch (error) {
    console.log("Mongo Error:", error);
  }
};

fetchToken();

// fetch/search flights

app.post("/api/travelport/search", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.pp.travelport.com/11/air/catalog/search/catalogproductofferings",
      req.body,
      {
        headers: {
          Authorization: `Bearer ${Token}`,
          "Content-Type": "application/json",
          XAUTH_TRAVELPORT_ACCESSGROUP: Access_Group,
          Accept: "application/json",
          taxBreakDown: true,
          "Accept-Version": 11,
          "Content-Version": 11,
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }
    );
    res.status(200).json(response.data);
  } catch (error) {
    console.log(error?.response?.data || error?.message);
    if (
      error?.response?.data ===
        "1012117 - Invalid token. The token has expired." ||
      !Token
    ) {
      generateTokenAndSaveTODB();
    }
    res.status(500).json({ error: error.message });
  }
});

// fetch/confirm pricing

app.post("/api/travelport/price", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.pp.travelport.com/11/air/price/offers/buildfromcatalogproductofferings",
      req.body,
      {
        headers: {
          Authorization: `Bearer ${Token}`,
          "Content-Type": "application/json",
          XAUTH_TRAVELPORT_ACCESSGROUP: Access_Group,
          Accept: "application/json",
          taxBreakDown: true,
          "Accept-Version": 11,
          "Content-Version": 11,
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seat Selection

app.post("/api/travelport/seat", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.pp.travelport.com/11/air/search/seat/catalogofferingsancillaries/seatavailabilities",
      req.body,
      {
        headers: {
          Authorization: `Bearer ${Token}`,
          "Content-Type": "application/json",
          XAUTH_TRAVELPORT_ACCESSGROUP: Access_Group,
          Accept: "application/json",
          taxBreakDown: true,
          "Accept-Version": 11,
          "Content-Version": 11,
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// creating workbench (booking session)

app.post("/api/travelport/workbench-initial", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.pp.travelport.com/11/air/book/session/reservationworkbench",
      req.body,
      {
        headers: {
          Authorization: `Bearer ${Token}`,
          "Content-Type": "application/json",
          XAUTH_TRAVELPORT_ACCESSGROUP: Access_Group,
          Accept: "application/json",
          taxBreakDown: true,
          "Accept-Version": 11,
          "Content-Version": 11,
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add Offer to the Workbench

app.post("/api/travelport/offer-to-workbench", async (req, res) => {
  try {
    const response = await axios.post(
      `https://api.pp.travelport.com/11/air/book/airoffer/reservationworkbench/${req.body.workbench_id}/offers/buildfromcatalogproductofferings`,
      req.body,
      {
        headers: {
          Authorization: `Bearer ${Token}`,
          "Content-Type": "application/json",
          XAUTH_TRAVELPORT_ACCESSGROUP: Access_Group,
          Accept: "application/json",
          taxBreakDown: true,
          "Accept-Version": 11,
          "Content-Version": 11,
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add Travelers (multi-passenger)

app.post("/api/travelport/add-traveler-to-workbench", async (req, res) => {
  try {
    const response = await axios.post(
      `https://api.pp.travelport.com/11/air/book/traveler/reservationworkbench/${req.body.workbench_id}/travelers`,
      req.body,
      {
        headers: {
          Authorization: `Bearer ${Token}`,
          "Content-Type": "application/json",
          XAUTH_TRAVELPORT_ACCESSGROUP: Access_Group,
          Accept: "application/json",
          taxBreakDown: true,
          "Accept-Version": 11,
          "Content-Version": 11,
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seat Map (Seat Booking) : OPTIONAL

app.post("/api/travelport/seat-map", async (req, res) => {
  try {
    const response = await axios.post(
      `https://api.pp.travelport.com/11/air/search/seat/catalogofferingsancillaries/seatavailabilities`,
      req.body,
      {
        headers: {
          Authorization: `Bearer ${Token}`,
          "Content-Type": "application/json",
          XAUTH_TRAVELPORT_ACCESSGROUP: Access_Group,
          Accept: "application/json",
          taxBreakDown: true,
          "Accept-Version": 11,
          "Content-Version": 11,
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seat Map (Seat Booking) : OPTIONAL

app.post("/api/travelport/seat-book", async (req, res) => {
  try {
    const response = await axios.post(
      `https://api.pp.travelport.com/11/air/search/seat/catalogofferingsancillaries/seatavailabilities`,
      req.body,
      {
        headers: {
          Authorization: `Bearer ${Token}`,
          "Content-Type": "application/json",
          XAUTH_TRAVELPORT_ACCESSGROUP: Access_Group,
          Accept: "application/json",
          taxBreakDown: true,
          "Accept-Version": 11,
          "Content-Version": 11,
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seat Map to Workbench (Seat Booking) : OPTIONAL

app.post("/api/travelport/seat-map-to-workbench", async (req, res) => {
  try {
    const response = await axios.post(
      `https://api.pp.travelport.com/11/air/book/airoffer/reservationworkbench/${req.body.workbench_id}/offers/buildancillaryoffersfromcatalogofferings`,
      req.body,
      {
        headers: {
          Authorization: `Bearer ${Token}`,
          "Content-Type": "application/json",
          XAUTH_TRAVELPORT_ACCESSGROUP: Access_Group,
          Accept: "application/json",
          taxBreakDown: true,
          "Accept-Version": 11,
          "Content-Version": 11,
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Form of Payment

app.post("/api/travelport/form-of-payment", async (req, res) => {
  try {
    const response = await axios.post(
      `https://api.pp.travelport.com/11/air/payment/reservationworkbench/${req.body.workbench_id}/formofpayment`,
      req.body,
      {
        headers: {
          Authorization: `Bearer ${Token}`,
          "Content-Type": "application/json",
          XAUTH_TRAVELPORT_ACCESSGROUP: Access_Group,
          Accept: "application/json",
          taxBreakDown: true,
          "Accept-Version": 11,
          "Content-Version": 11,
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add Payment to Offer

app.post("/api/travelport/payment-to-workbench", async (req, res) => {
  try {
    const response = await axios.post(
      `https://api.pp.travelport.com/11/air/paymentoffer/reservationworkbench/${req.body.workbench_id}/payments`,
      req.body,
      {
        headers: {
          Authorization: `Bearer ${Token}`,
          "Content-Type": "application/json",
          XAUTH_TRAVELPORT_ACCESSGROUP: Access_Group,
          Accept: "application/json",
          taxBreakDown: true,
          "Accept-Version": 11,
          "Content-Version": 11,
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Commit the workbench

app.post("/api/travelport/commit-to-workbench", async (req, res) => {
  try {
    const response = await axios.post(
      `https://api.pp.travelport.com/11/air/book/reservation/reservations/${req.body.workbench_id}`,
      req.body,
      {
        headers: {
          Authorization: `Bearer ${Token}`,
          "Content-Type": "application/json",
          XAUTH_TRAVELPORT_ACCESSGROUP: Access_Group,
          Accept: "application/json",
          taxBreakDown: true,
          "Accept-Version": 11,
          "Content-Version": 11,
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fare Rules and Exchanges

app.post("/api/travelport/fare-rules", async (req, res) => {
  try {
    const response = await axios.post(
      `https://api.pp.travelport.com/11/air/air/faredisplay/fares`,
      req.body,
      {
        headers: {
          Authorization: `Bearer ${Token}`,
          "Content-Type": "application/json",
          XAUTH_TRAVELPORT_ACCESSGROUP: Access_Group,
          Accept: "application/json",
          taxBreakDown: true,
          "Accept-Version": 11,
          "Content-Version": 11,
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(4000, () => console.log("Proxy server running on port 4000"));
