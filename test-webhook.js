// test-webhook.js
fetch("http://localhost:4000/api/webhooks/hotmart", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        "id": "2eecd200-a927-4cdd-84d5-82e75e9ba23b",
        "creation_date": 1614777592395,
        "event": "PURCHASE_APPROVED",
        "version": "2.0.0",
        "data": {
            "product": {
                "id": 7336724,
                "name": "Sua Casa Organizada - Dash",
                "has_co_production": false
            },
            "affiliates": [],
            "buyer": {
                "email": "teste@hotmart.com",
                "name": "Comprador de Testes"
            },
            "producer": {
                "name": "Produtor de Testes"
            },
            "commissions": [],
            "purchase": {
                "transaction": "HP123456789",
                "status": "APPROVED",
                "order_date": 1614777592395,
                "approved_date": 1614777592395,
                "price": {
                    "value": 150.00,
                    "currency_value": "BRL"
                },
                "payment": {
                    "type": "CREDIT_CARD",
                    "installments_number": 1
                }
            }
        }
    })
}).then(res => res.json()).then(console.log).catch(console.error);
