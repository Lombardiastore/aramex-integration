require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// 🕒 تحويل التاريخ إلى صيغة /Date(...)/
function toAramexDate(date) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const hours = pad(offset / 60);
  const minutes = pad(offset % 60);
  return `/Date(${date.getTime()}${sign}${hours}${minutes})/`;
}

// 🟢 تسجيل ومراقبة الطلبات للمنع التكرار
const processedOrders = new Set();
function isOrderProcessed(orderId) {
  return processedOrders.has(orderId);
}
function markOrderAsProcessed(orderId) {
  processedOrders.add(orderId);
}

app.post('/webhook', async (req, res) => {
  console.log('🔔 Webhook received from Shopify!');
  console.log('📦 FULL Webhook Payload:', JSON.stringify(req.body, null, 2));
  const order = req.body;

  let locationId = order.location_id;
  if (!locationId && order.line_items?.[0]?.origin_location?.id) {
    locationId = order.line_items[0].origin_location.id;
  }

  async function getLocationById(locationId) {
    const shop = 'lombardiastore.com';
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    try {
      const res = await axios.get(
        `https://${shop}/admin/api/2024-01/locations/${locationId}.json`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        }
      );
      return res.data.location;
    } catch (err) {
      console.error('❌ Error fetching location:', err.response?.data || err.message);
      return null;
    }
  }

  const locationInfo = locationId ? await getLocationById(locationId) : null;
  const shippingAddress = order.shipping_address;
  const isCOD = order.payment_gateway_names.includes("Cash on Delivery (COD)");

  const orderId = order.id;
  if (isOrderProcessed(orderId)) {
    console.log('⚠️ Order already processed. Skipping.');
    return res.status(200).send('Already processed');
  }

  const payload = {
    ClientInfo: {
      UserName: "testingapi@aramex.com",
      Password: "R123456789$r",
      Version: "v1",
      AccountNumber: "20016",
      AccountPin: "543543",
      AccountEntity: "AMM",
      AccountCountryCode: "JO",
      Source: 24
    },
    Shipments: [
      {
        Reference1: orderId.toString(),
        Reference2: "",
        Reference3: "",
        Shipper: {
          Reference1: orderId.toString(),
          Reference2: "",
          AccountNumber: "20016",
          PartyAddress: {
            Line1: locationInfo?.address1 || "Default Address",
            Line2: locationInfo?.address2 || "",
            Line3: "",
            City: locationInfo?.city || "Amman",
            PostCode: locationInfo?.zip || "",
            CountryCode: locationInfo?.country_code || "JO",
            Longitude: 0,
            Latitude: 0
          },
          Contact: {
            PersonName: locationInfo?.name || "Default Name",
            CompanyName: locationInfo?.name || "Default Name",
            PhoneNumber1: locationInfo?.phone || "962790000000",
            PhoneNumber2: "",
            PhoneNumber1Ext: "",
            PhoneNumber2Ext: "",
            FaxNumber: "",
            CellPhone: locationInfo?.phone || "962790000000",
            EmailAddress: "info@lombardiastore.com",
            Type: ""
          }
        },
        Consignee: {
          Reference1: orderId.toString(),
          Reference2: "",
          AccountNumber: "",
          PartyAddress: {
            Line1: shippingAddress?.address1 || "Cnee Address Line 1",
            Line2: shippingAddress?.address2 || "",
            Line3: "",
            City: shippingAddress?.city || "AMMAN",
            StateOrProvinceCode: shippingAddress?.province || "",
            PostCode: shippingAddress?.zip || "",
            CountryCode: shippingAddress?.country_code || "JO",
            Longitude: 0,
            Latitude: 0,
            BuildingNumber: "",
            BuildingName: "",
            Floor: "",
            Apartment: "",
            POBox: null,
            Description: ""
          },
          Contact: {
            Department: "",
            PersonName: `${shippingAddress?.first_name || ""} ${shippingAddress?.last_name || ""}`.trim(),
            Title: "",
            CompanyName: shippingAddress?.company || "",
            PhoneNumber1: shippingAddress?.phone || "962790000001",
            PhoneNumber1Ext: "",
            PhoneNumber2: "",
            PhoneNumber2Ext: "",
            FaxNumber: "",
            CellPhone: shippingAddress?.phone || "962790000001",
            EmailAddress: order.email || "",
            Type: ""
          }
        },
        ThirdParty: {
          Reference1: orderId.toString(),
          Reference2: "",
          AccountNumber: "",
          PartyAddress: {
            Line1: "",
            Line2: "",
            Line3: "",
            City: "",
            StateOrProvinceCode: "",
            PostCode: "",
            CountryCode: "",
            Longitude: 0,
            Latitude: 0,
            BuildingNumber: null,
            BuildingName: null,
            Floor: null,
            Apartment: null,
            POBox: null,
            Description: null
          },
          Contact: {
            Department: "",
            PersonName: "",
            Title: "",
            CompanyName: "",
            PhoneNumber1: "",
            PhoneNumber1Ext: "",
            PhoneNumber2: "",
            PhoneNumber2Ext: "",
            FaxNumber: "",
            CellPhone: "",
            EmailAddress: "",
            Type: ""
          }
        },
        ShippingDateTime: toAramexDate(new Date()),
        DueDate: toAramexDate(new Date()),
        Comments: "",
        PickupLocation: "",
        OperationsInstructions: "",
        AccountingInstrcutions: "",
        Details: {
          Dimensions: { Length: 10, Width: 10, Height: 10, Unit: "CM" },
          ActualWeight: { Unit: "KG", Value: 0.5 },
          ChargeableWeight: { Unit: "KG", Value: 0.5 },
          DescriptionOfGoods: "Test order",
          GoodsOriginCountry: "JO",
          NumberOfPieces: 1,
          ProductGroup: "DOM",
          ProductType: "ONP",
          PaymentType: isCOD ? "C" : "P",
          PaymentOptions: "",
          CustomsValueAmount: { CurrencyCode: "JOD", Value: 0 },
          CashOnDeliveryAmount: { CurrencyCode: "JOD", Value: isCOD ? parseFloat(order.total_price) : 0 },
          InsuranceAmount: null,
          CashAdditionalAmount: null,
          CashAdditionalAmountDescription: "",
          CollectAmount: null,
          Services: "",
          Items: {
            Comments: "",
            GoodsDescription: "",
            CountryOfOrigin: "",
            Reference: "",
            CommodityCode: ""
          }
        },
        Attachments: [],
        ForeignHAWB: "",
        TransportType: 0,
        PickupGUID: "",
        Number: null,
        ScheduledDelivery: null
      }
    ],
    LabelInfo: {
      ReportID: 9729,
      ReportType: "URL"
    },
    Transaction: {
      Reference1: orderId.toString(),
      Reference2: "",
      Reference3: "",
      Reference4: "",
      Reference5: ""
    }
  };

  try {
    const createShipmentRes = await axios.post(
      'https://ws.sbx.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreateShipments',
      payload,
      { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );

    console.log('✅ Aramex CreateShipment Response:', createShipmentRes.data);

    const shipmentID = createShipmentRes.data?.Shipments?.[0]?.ID;
    if (!shipmentID) return res.status(400).send('Shipment creation failed');

    const SHIPMENTS_DATA_FILE = path.join(__dirname, 'shipments.json');
    let shipmentRefs = {};
    if (fs.existsSync(SHIPMENTS_DATA_FILE)) {
      shipmentRefs = JSON.parse(fs.readFileSync(SHIPMENTS_DATA_FILE));
    }
    shipmentRefs[orderId] = shipmentID;
    fs.writeFileSync(SHIPMENTS_DATA_FILE, JSON.stringify(shipmentRefs, null, 2));
    console.log(`💾 Saved Shipment ID for order ${orderId}`);

    const labelPayload = {
      ClientInfo: payload.ClientInfo,
      LabelInfo: payload.LabelInfo,
      OriginEntity: "AMM",
      ProductGroup: "DOM",
      ShipmentNumber: shipmentID,
      Transaction: payload.Transaction
    };

    const labelRes = await axios.post(
      'https://ws.sbx.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/PrintLabel',
      labelPayload,
      { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );

    const labelUrl = labelRes.data.LabelURL || labelRes.data?.ShipmentLabel?.LabelURL;
    console.log('✅ Label URL:', labelUrl);

    const pickupPayload = {
      ClientInfo: payload.ClientInfo,
      LabelInfo: { ReportID: 9201, ReportType: "URL" },
      Pickup: {
        PickupAddress: payload.Shipments[0].Shipper.PartyAddress,
        PickupContact: payload.Shipments[0].Shipper.Contact,
        PickupLocation: "Reception",
        PickupDate: toAramexDate(new Date()),
        ReadyTime: toAramexDate(new Date()),
        LastPickupTime: toAramexDate(new Date()),
        ClosingTime: toAramexDate(new Date()),
        Comments: "",
        Reference1: "Ref1",
        Reference2: "",
        Vehicle: "",
        Shipments: [],
        PickupItems: [
          {
            ProductGroup: "DOM",
            ProductType: "ONP",
            NumberOfShipments: 1,
            PackageType: "",
            Payment: "P",
            ShipmentWeight: { Unit: "KG", Value: 0.5 },
            ShipmentVolume: null,
            NumberOfPieces: 1,
            ShipmentDimensions: { Length: 0, Width: 0, Height: 0, Unit: "" },
            CashAmount: null,
            ExtraCharges: null,
            Comments: ""
          }
        ],
        Status: "Ready",
        ExistingShipments: null,
        Branch: "",
        RouteCode: ""
      },
      Transaction: payload.Transaction
    };

    const pickupRes = await axios.post(
      'https://ws.sbx.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreatePickup',
      pickupPayload,
      { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );

    console.log('✅ Pickup created successfully:', pickupRes.data);

    const CANCELED_DATA_FILE = path.join(__dirname, 'pickup_references.json');
    let pickupRefs = {};
    if (fs.existsSync(CANCELED_DATA_FILE)) {
      pickupRefs = JSON.parse(fs.readFileSync(CANCELED_DATA_FILE));
    }
    if (pickupRes.data?.ProcessedPickup?.GUID) {
      pickupRefs[orderId] = pickupRes.data.ProcessedPickup.GUID;
      fs.writeFileSync(CANCELED_DATA_FILE, JSON.stringify(pickupRefs, null, 2));
      console.log(`💾 Saved Pickup GUID for order ${orderId}`);
    }

    const shop = 'lombardiastore.com';
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const trackingUrl = `https://www.aramex.com/track/results?mode=0&ShipmentNumber=${shipmentID}`;
    const fulfillmentPayload = {
      fulfillment: {
        tracking_number: shipmentID,
        tracking_urls: [trackingUrl],
        notify_customer: true
      }
    };

    await axios.post(
      `https://${shop}/admin/api/2024-01/orders/${orderId}/fulfillments.json`,
      fulfillmentPayload,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Shopify order fulfilled with tracking number:', shipmentID);
    markOrderAsProcessed(orderId);
    res.status(200).send('Success');
  } catch (error) {
    console.error('❌ Aramex Error:', error.response?.data || error.message);
    res.status(500).send('Failed');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
