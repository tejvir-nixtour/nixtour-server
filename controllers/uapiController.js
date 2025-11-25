const axios = require("axios");
const xml2js = require("xml2js");
const { combineListsWithCommonKeyValue } = require("../helpers/uapiHelpers");

const parameters = (TypeCode = "AirAndRailSupplierType") => {
  const params = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:util="http://www.travelport.com/schema/util_v50_0" xmlns:com="http://www.travelport.com/schema/common_v50_0">
   <soapenv:Header/>
   <soapenv:Body>
      <util:ReferenceDataRetrieveReq AuthorizedBy="user" TargetBranch="P7141920" TraceId="trace" TypeCode="${TypeCode}">
         <com:BillingPointOfSaleInfo OriginApplication="UAPI"/>
         <util:ReferenceDataSearchModifiers MaxResults="99999" StartFromResult="0"/>
      </util:ReferenceDataRetrieveReq>
   </soapenv:Body>
</soapenv:Envelope>
    `;

  return params;
};

const refParameters = (Type = "Airport") => {
  const params = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:util="http://www.travelport.com/schema/util_v50_0" xmlns:com="http://www.travelport.com/schema/common_v50_0">
   <soapenv:Header/>
   <soapenv:Body>
      <ReferenceDataSearchReq AuthorizedBy="mk" TargetBranch="P7141920" xmlns="http://www.travelport.com/schema/util_v50_0" xmlns:common="http://www.travelport.com/schema/common_v50_0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.travelport.com/schema/util_v50_0 file:///C:/Users/mukil.kumar/Documents/Ecommerce/WSDL/Release-V19.1.0.53-V19.1/util_v50_0/Util.xsd">
            <common:BillingPointOfSaleInfo OriginApplication="uAPI"/>
            <ReferenceDataSearchItem Type="${Type}"/>
</ReferenceDataSearchReq>
   </soapenv:Body>
</soapenv:Envelope>
    `;

  return params;
};

const getData = (req, res) => {
  const { key } = req.params;

  console.log(`Request parameters: ${key}`);

  axios
    .post(
      "https://apac.universal-api.pp.travelport.com/B2BGateway/connect/uAPI/UtilService",
      parameters(key),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.TRAVELPORT_UAPI_USERNAME}:${process.env.TRAVELPORT_UAPI_PASSWORD}`
          ).toString("base64")}`,
          "Content-Type": "text/xml; charset=UTF-8",
          "Cache-Control": "no-cache",
          "Accept-Encoding": "gzip, deflate",
        },
      }
    )
    .then(async (response) => {
      if (!response.data) {
        return res.status(500).json({ error: "No data received" });
      }

      try {
        // Debug: log size and prefix if parsing yields unexpected empty object
        console.log("Response XML length:", response.data.length);
        // console.log("Response XML preview:", response.data.slice(0, 500));

        const parserOptions = {
          explicitArray: false,
          ignoreAttrs: false,
          mergeAttrs: true,
          trim: true,
        };

        const result = await xml2js.parseStringPromise(
          response.data,
          parserOptions
        );

        // If result looks empty, log it for debugging
        if (!result || Object.keys(result).length === 0) {
          console.warn("Parsed XML is empty or has no top-level keys.");
        }

        return res.json({
          json: result?.["SOAP:Envelope"]?.["SOAP:Body"]?.[
            "util:ReferenceDataRetrieveRsp"
          ]?.["util:ReferenceDataItem"],
        });
      } catch (error) {
        console.log(`Error parsing XML: ${error}`);
        return res.status(500).json({ error: "Error parsing XML" });
      }
    })
    .catch((error) => {
      console.log(`Error: ${error}`);
      return res
        .status(500)
        .json({ error: "Error occurred while processing request" });
    });
};

const getCombinedData = async (req, res) => {
  const response = {};

  const airport = await axios.post(
    "https://apac.universal-api.pp.travelport.com/B2BGateway/connect/uAPI/ReferenceDataLookupService",
    refParameters(),
    {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.TRAVELPORT_UAPI_USERNAME}:${process.env.TRAVELPORT_UAPI_PASSWORD}`
        ).toString("base64")}`,
        "Content-Type": "text/xml; charset=UTF-8",
        "Cache-Control": "no-cache",
        "Accept-Encoding": "gzip, deflate",
      },
    }
  );

  if (!airport.data) {
    return res.status(500).json({ error: "No data received" });
  }

  try {
    // Debug: log size and prefix if parsing yields unexpected empty object
    console.log("Response XML length:", airport.data.length);
    // console.log("Response XML preview:", response.data.slice(0, 500));

    const parserOptions = {
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
      trim: true,
    };

    const airportResult = await xml2js.parseStringPromise(
      airport.data,
      parserOptions
    );

    // If result looks empty, log it for debugging
    if (!airportResult || Object.keys(airportResult).length === 0) {
      console.warn("Parsed XML is empty or has no top-level keys.");
    }

    const jsonAirportList =
      airportResult?.["SOAP:Envelope"]?.["SOAP:Body"]?.[
        "util:ReferenceDataSearchRsp"
      ]?.["util:Airport"];

    // Adding Cities with Airports to the response

    const cities = await axios.post(
      "https://apac.universal-api.pp.travelport.com/B2BGateway/connect/uAPI/ReferenceDataLookupService",
      refParameters("City"),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.TRAVELPORT_UAPI_USERNAME}:${process.env.TRAVELPORT_UAPI_PASSWORD}`
          ).toString("base64")}`,
          "Content-Type": "text/xml; charset=UTF-8",
          "Cache-Control": "no-cache",
          "Accept-Encoding": "gzip, deflate",
        },
      }
    );

    if (!cities.data) {
      return res.status(500).json({ error: "No data received" });
    }

    try {
      // Debug: log size and prefix if parsing yields unexpected empty object
      console.log("Response XML length:", cities.data.length);
      // console.log("Response XML preview:", response.data.slice(0, 500));

      const citiesResult = await xml2js.parseStringPromise(
        cities.data,
        parserOptions
      );

      // If result looks empty, log it for debugging
      if (!citiesResult || Object.keys(citiesResult).length === 0) {
        console.warn("Parsed XML is empty or has no top-level keys.");
      }

      const jsonCitiesList =
        citiesResult?.["SOAP:Envelope"]?.["SOAP:Body"]?.[
          "util:ReferenceDataSearchRsp"
        ]?.["util:City"];

      //   response["airports"] = jsonAirportList;
      //   response["cities"] = jsonCitiesList;
      response["combined"] = combineListsWithCommonKeyValue(
        jsonAirportList,
        "CityCode",
        jsonCitiesList,
        "Code"
      );
    } catch (error) {
      console.log("Error in parsing cities:", error);
    }

    return res.json(response);
  } catch (error) {
    console.log(`Error parsing XML: ${error}`);
    return res.status(500).json({ error: "Error parsing XML" });
  }
};

module.exports = { getData, getCombinedData };
