{\rtf1\ansi\ansicpg1252\cocoartf2639
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);\
\
exports.handler = async (event) => \{\
  try \{\
    const data = JSON.parse(event.body);\
\
    const session = await stripe.checkout.sessions.create(\{\
      mode: "payment",\
\
      payment_method_types: ["card"],\
      billing_address_collection: "required",\
\
      line_items: [\
        \{\
          price_data: \{\
            currency: "usd",\
            product_data: \{\
              name: "Custom Stickers",\
              description: `$\{data.quantity\} stickers \'96 $\{data.width\}x$\{data.height\}`,\
            \},\
            unit_amount: Math.round(Number(data.total) * 100),\
          \},\
          quantity: 1,\
        \},\
      ],\
\
      metadata: \{\
        job_name: data.jobName,\
        width: data.width,\
        height: data.height,\
        quantity: data.quantity,\
        upload_source: data.upload_source,\
      \},\
\
      success_url: "https://www.unfoldingcreative.com/order-success",\
      cancel_url: "https://www.unfoldingcreative.com/orderstickers",\
    \});\
\
    return \{\
      statusCode: 200,\
      body: JSON.stringify(\{ url: session.url \}),\
    \};\
  \} catch (err) \{\
    return \{\
      statusCode: 500,\
      body: JSON.stringify(\{ error: err.message \}),\
    \};\
  \}\
\};\
}