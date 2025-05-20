const axios = require('axios');

async function createShipment(order) {
  const payload = {
    ClientInfo: {
      UserName: 'testingapi@aramex.com',
      Password: 'R123456789$r',
      Version: 'v1',
      AccountNumber: '20016',
      AccountPin: '543543',
      AccountEntity: 'AMM',
      AccountCountryCode: 'JO',
      Source: 24
    },
    Shipments: [
      {
        Reference1: `${order.id}`,
        Shipper: {
          Reference1: '',
          AccountNumber: '20016',
          PartyAddress: {
            Line1: 'Shpr Address Line 1',
            Line2: '',
            Line3: '',
            City: 'AMMAN',
            PostCode: '',
            CountryCode: 'JO',
            Longitude: 0,
            Latitude: 0
          },
          Contact: {
            Department: '',
            PersonName: 'Shpr Person Name',
            Title: '',
            CompanyName: 'Shpr Company Name',
            PhoneNumber1: '962790000000',
            PhoneNumber1Ext: '',
            PhoneNumber2: '',
            PhoneNumber2Ext: '',
            FaxNumber: '',
            CellPhone: '962790000000',
            EmailAddress: 'shpr@emailadress.com',
            Type: ''
          }
        },
        Consignee: {
          Reference1: '',
          PartyAddress: {
            Line1: 'Cnee Address Line 1',
            Line2: '',
            Line3: '',
            City: 'AMMAN',
            PostCode: '',
            CountryCode: 'JO',
            Longitude: 0,
            Latitude: 0
          },
          Contact: {
            Department: '',
            PersonName: 'Cnee Person Name',
            Title: '',
            CompanyName: 'Cnee Company Name',
            PhoneNumber1: '962790000001',
            PhoneNumber1Ext: '',
            PhoneNumber2: '',
            PhoneNumber2Ext: '',
            FaxNumber: '',
            CellPhone: '962790000001',
            EmailAddress: 'cnee@emailadress.com',
            Type: ''
          }
        },
        ShippingDateTime: `/Date(${Date.now()})/`,
        DueDate: `/Date(${Date.now()})/`,
        Details: {
          Dimensions: {
            Length: 10,
            Width: 10,
            Height: 10,
            Unit: 'CM'
          },
          ActualWeight: {
            Unit: 'KG',
            Value: 0.5
          },
          DescriptionOfGoods: 'Test order',
          GoodsOriginCountry: 'JO',
          NumberOfPieces: 1,
          ProductGroup: 'DOM',
          ProductType: 'ONP',
          PaymentType: 'P'
        }
      }
    ],
    LabelInfo: {
      ReportID: 9729,
      ReportType: 'URL'
    },
    Transaction: {
      Reference1: `${order.id}`
    }
  };

  const response = await axios.post(
    'https://ws.sbx.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreateShipments',
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    }
  );

  return response.data;
}

module.exports = createShipment;
