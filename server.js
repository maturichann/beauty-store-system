 const express = require('express');
  const path = require('path');
  const cors = require('cors');
  const bodyParser = require('body-parser');
  const stripe = require('stripe');
  const { google } = require('googleapis');
  const { Resend } = require('resend');
  const { v4: uuidv4 } = require('uuid');
  require('dotenv').config();

  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(cors());
  app.use(express.static('public'));
  app.use(bodyParser.json());
  app.use(express.static('public'));

  // 初期化
  let stripeClient;
  let resendClient;
  let sheetsAuth;

  const initializeServices = () => {
      try {
          // Stripe初期化
          if (process.env.STRIPE_SECRET_KEY) {
              stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
              console.log('✅ Stripe initialized');
          } else {
              console.log('⚠️ STRIPE_SECRET_KEY not found');
          }

          // Resend初期化
          if (process.env.RESEND_API_KEY) {
              resendClient = new Resend(process.env.RESEND_API_KEY);
              console.log('✅ Resend initialized');
          } else {
              console.log('⚠️ RESEND_API_KEY not found');
          }

          // Google Sheets初期化
          if (process.env.GOOGLE_SHEETS_PRIVATE_KEY && process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
              const auth = new google.auth.GoogleAuth({
                  credentials: {
                      type: 'service_account',
                      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
                      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
                      client_id: process.env.GOOGLE_SHEETS_CLIENT_ID,
                  },
                  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
              });
              sheetsAuth = auth;
              console.log('✅ Google Sheets initialized');
          } else {
              console.log('⚠️ Google Sheets credentials not found');
          }
      } catch (error) {
          console.error('Error initializing services:', error);
      }
  };

  // 商品データ
  const products = {
      megami: {
          price: 3894,
          name: 'I am MEGAMI フェイシャルパック',
          code: 'MGM-001'
      },
      leaflet: {
          price: 22,
          name: 'I am MEGAMI リーフレット（10枚）',
          code: 'MGM-002'
      }
  };

  // Google Sheetsに注文データを追加
  async function addToGoogleSheets(orderData) {
      if (!sheetsAuth || !process.env.GOOGLE_SHEETS_ID) {
          console.log('Google Sheets not configured');
          return { success: false, error: 'Google Sheets not configured' };
      }

      try {
          const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });

          const values = [[
              new Date().toLocaleString('ja-JP'),
              orderData.orderId,
              orderData.orderType,
              `${orderData.lastName} ${orderData.firstName}`,
              `${orderData.lastNameKana} ${orderData.firstNameKana}`,
              orderData.salonName,
              orderData.email,
              orderData.phone,
              `${orderData.postalCode} ${orderData.prefecture}${orderData.city}${orderData.address} 
  ${orderData.building || ''}`,
              orderData.deliveryTime,
              orderData.megamiQuantity || 0,
              orderData.leafletQuantity || 0,
              orderData.subtotal,
              orderData.shipping,
              orderData.total,
              orderData.paymentMethod,
              orderData.paymentStatus || 'pending'
          ]];

          await sheets.spreadsheets.values.append({
              spreadsheetId: process.env.GOOGLE_SHEETS_ID,
              range: 'A:Q',
              valueInputOption: 'RAW',
              resource: { values }
          });

          console.log('✅ Data added to Google Sheets');
          return { success: true };
      } catch (error) {
          console.error('Error adding to Google Sheets:', error);
          return { success: false, error: error.message };
      }
  }

  // メール送信
  async function sendOrderEmail(orderData) {
      if (!resendClient || !process.env.FROM_EMAIL) {
          console.log('Email service not configured');
          return { success: false, error: 'Email service not configured' };
      }

      try {
          const itemsHtml = [];

          if (orderData.megamiQuantity > 0) {
              itemsHtml.push(`<tr>
                  <td>${products.megami.name}</td>
                  <td>${orderData.megamiQuantity}個</td>
                  <td>¥${(orderData.megamiQuantity * products.megami.price).toLocaleString()}</td>
              </tr>`);
          }

          if (orderData.leafletQuantity > 0) {
              itemsHtml.push(`<tr>
                  <td>${products.leaflet.name}</td>
                  <td>${orderData.leafletQuantity}枚</td>
                  <td>¥${(orderData.leafletQuantity * products.leaflet.price).toLocaleString()}</td>
              </tr>`);
          }

          // 銀行振込の場合の口座情報
          const bankInfo = orderData.paymentMethod === 'bank_transfer' ? `
          <h3>お振込先口座情報</h3>
          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>金融機関名:</strong> 鹿児島信用金庫</p>
              <p><strong>支店名:</strong> 隼人支店</p>
              <p><strong>口座種別:</strong> 普通預金</p>
              <p><strong>口座番号:</strong> 7552868</p>
              <p><strong>名義人:</strong> メガミ(ド)</p>
              <p style="color: #856404; font-size: 14px; margin-top: 10px;">※ お振込確認後、発送いたします</p>
          </div>
          ` : '';

          const emailHtml = `
          <h2>ご注文ありがとうございます</h2>
          <p>${orderData.lastName} ${orderData.firstName} 様</p>

          <p>以下の内容でご注文を承りました。</p>

          <h3>注文詳細</h3>
          <p><strong>注文番号:</strong> ${orderData.orderId}</p>
          <p><strong>注文種別:</strong> ${orderData.orderType === 'first' ? '初回発注' : '2回目以降'}</p>

          <h3>商品内容</h3>
          <table border="1" style="border-collapse: collapse; width: 100%;">
              <tr style="background-color: #f5f5f5;">
                  <th style="padding: 8px;">商品名</th>
                  <th style="padding: 8px;">数量</th>
                  <th style="padding: 8px;">金額</th>
              </tr>
              ${itemsHtml.join('')}
              <tr>
                  <td style="padding: 8px;"><strong>商品合計</strong></td>
                  <td style="padding: 8px;"></td>
                  <td style="padding: 8px;"><strong>¥${orderData.subtotal.toLocaleString()}</strong></td>
              </tr>
              <tr>
                  <td style="padding: 8px;">送料</td>
                  <td style="padding: 8px;"></td>
                  <td style="padding: 8px;">${orderData.shipping === 0 ? '無料' : '¥' + 
  orderData.shipping.toLocaleString()}</td>
              </tr>
              <tr style="background-color: #f5f5f5;">
                  <td style="padding: 8px;"><strong>合計</strong></td>
                  <td style="padding: 8px;"></td>
                  <td style="padding: 8px;"><strong>¥${orderData.total.toLocaleString()}</strong></td>
              </tr>
          </table>

          ${bankInfo}

          <h3>配送先情報</h3>
          <p>
          ${orderData.postalCode}<br>
          ${orderData.prefecture}${orderData.city}${orderData.address}<br>
          ${orderData.building || ''}<br>
          配達希望時間: ${orderData.deliveryTime}
          </p>

          <h3>お支払い方法</h3>
          <p>${orderData.paymentMethod === 'credit_card' ? 'クレジットカード決済' : '銀行振込'}</p>

          <hr>
          <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
          <p><strong>MEGAMI合同会社</strong><br>
          電話: 0995-55-8368</p>
          `;

          const result = await resendClient.emails.send({
              from: process.env.FROM_EMAIL,
              to: [orderData.email],
              subject: `【MEGAMI合同会社】ご注文確認 - ${orderData.orderId}`,
              html: emailHtml
          });

          console.log('✅ Order confirmation email sent');
          return { success: true, emailId: result.data?.id };
      } catch (error) {
          console.error('Error sending email:', error);
          return { success: false, error: error.message };
      }
  }

  // 管理者通知メール送信
  async function sendAdminNotificationEmail(orderData) {
      if (!resendClient || !process.env.FROM_EMAIL || !process.env.ADMIN_EMAIL) {
          console.log('Admin email service not configured');
          return { success: false, error: 'Admin email service not configured' };
      }

      try {
          const itemsHtml = [];

          if (orderData.megamiQuantity > 0) {
              itemsHtml.push(`<tr>
                  <td>${products.megami.name}</td>
                  <td>${orderData.megamiQuantity}個</td>
                  <td>¥${(orderData.megamiQuantity * products.megami.price).toLocaleString()}</td>
              </tr>`);
          }

          if (orderData.leafletQuantity > 0) {
              itemsHtml.push(`<tr>
                  <td>${products.leaflet.name}</td>
                  <td>${orderData.leafletQuantity}枚</td>
                  <td>¥${(orderData.leafletQuantity * products.leaflet.price).toLocaleString()}</td>
              </tr>`);
          }

          const emailHtml = `
          <h2>新しい注文が入りました</h2>
          
          <h3>注文情報</h3>
          <p><strong>注文番号:</strong> ${orderData.orderId}</p>
          <p><strong>注文種別:</strong> ${orderData.orderType === 'first' ? '初回発注' : '2回目以降'}</p>
          <p><strong>注文日時:</strong> ${new Date().toLocaleString('ja-JP')}</p>

          <h3>お客様情報</h3>
          <p><strong>お名前:</strong> ${orderData.lastName} ${orderData.firstName} (${orderData.lastNameKana} 
  ${orderData.firstNameKana})</p>
          <p><strong>サロン名:</strong> ${orderData.salonName}</p>
          <p><strong>メール:</strong> ${orderData.email}</p>
          <p><strong>電話:</strong> ${orderData.phone}</p>
          
          <h3>配送先</h3>
          <p>${orderData.postalCode}<br>
          ${orderData.prefecture}${orderData.city}${orderData.address}<br>
          ${orderData.building || ''}<br>
          配達希望時間: ${orderData.deliveryTime}</p>

          <h3>注文内容</h3>
          <table border="1" style="border-collapse: collapse; width: 100%;">
              <tr style="background-color: #f5f5f5;">
                  <th style="padding: 8px;">商品名</th>
                  <th style="padding: 8px;">数量</th>
                  <th style="padding: 8px;">金額</th>
              </tr>
              ${itemsHtml.join('')}
              <tr>
                  <td style="padding: 8px;"><strong>商品合計</strong></td>
                  <td style="padding: 8px;"></td>
                  <td style="padding: 8px;"><strong>¥${orderData.subtotal.toLocaleString()}</strong></td>
              </tr>
              <tr>
                  <td style="padding: 8px;">送料</td>
                  <td style="padding: 8px;"></td>
                  <td style="padding: 8px;">${orderData.shipping === 0 ? '無料' : '¥' + 
  orderData.shipping.toLocaleString()}</td>
              </tr>
              <tr style="background-color: #f5f5f5;">
                  <td style="padding: 8px;"><strong>合計</strong></td>
                  <td style="padding: 8px;"></td>
                  <td style="padding: 8px;"><strong>¥${orderData.total.toLocaleString()}</strong></td>
              </tr>
          </table>

          <h3>支払い方法</h3>
          <p>${orderData.paymentMethod === 'credit_card' ? 'クレジットカード決済' : '銀行振込'}</p>
          `;

          const result = await resendClient.emails.send({
              from: process.env.FROM_EMAIL,
              to: [process.env.ADMIN_EMAIL],
              subject: `【新規注文】${orderData.orderId} - ${orderData.lastName}様`,
              html: emailHtml
          });

          console.log('✅ Admin notification email sent');
          return { success: true, emailId: result.data?.id };
      } catch (error) {
          console.error('Error sending admin email:', error);
          return { success: false, error: error.message };
      }
  }

  // 注文処理エンドポイント
  app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.post('/api/orders', async (req, res) => {
      try {
          // 送料計算: 30,000円以上で無料
          const subtotal = (req.body.megamiQuantity || 0) * products.megami.price +
                          (req.body.leafletQuantity || 0) * products.leaflet.price;
          const shipping = subtotal >= 30000 ? 0 : 1100;
          const total = subtotal + shipping;

          const orderData = {
              ...req.body,
              orderId: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              createdAt: new Date(),
              subtotal,
              shipping,
              total
          };

          console.log('Processing order:', orderData.orderId);

          // Google Sheetsに保存
          const sheetsResult = await addToGoogleSheets(orderData);

          // メール送信
          const emailResult = await sendOrderEmail(orderData);

          // 管理者通知メール送信
          const adminEmailResult = await sendAdminNotificationEmail(orderData);

          // Stripe決済リンク作成（クレジットカード決済の場合）
          let paymentUrl = null;
          if (orderData.paymentMethod === 'credit_card' && stripeClient) {
              try {
                  const lineItems = [];

                  if (orderData.megamiQuantity > 0) {
                      lineItems.push({
                          price_data: {
                              currency: 'jpy',
                              product_data: {
                                  name: products.megami.name,
                                  description: products.megami.code
                              },
                              unit_amount: products.megami.price
                          },
                          quantity: orderData.megamiQuantity
                      });
                  }

                  if (orderData.leafletQuantity > 0) {
                      lineItems.push({
                          price_data: {
                              currency: 'jpy',
                              product_data: {
                                  name: products.leaflet.name,
                                  description: products.leaflet.code
                              },
                              unit_amount: products.leaflet.price
                          },
                          quantity: orderData.leafletQuantity
                      });
                  }

                  // 送料を追加
                  if (orderData.shipping > 0) {
                      lineItems.push({
                          price_data: {
                              currency: 'jpy',
                              product_data: {
                                  name: '送料'
                              },
                              unit_amount: orderData.shipping
                          },
                          quantity: 1
                      });
                  }

                  const session = await stripeClient.checkout.sessions.create({
                      payment_method_types: ['card'],
                      line_items: lineItems,
                      mode: 'payment',
                      success_url: `${req.headers.origin || 
  'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
                      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/cancel`,
                      metadata: {
                          orderId: orderData.orderId
                      }
                  });

                  paymentUrl = session.url;
                  console.log('✅ Stripe checkout session created');
              } catch (stripeError) {
                  console.error('Stripe error:', stripeError);
              }
          }

          res.json({
              success: true,
              orderId: orderData.orderId,
              paymentUrl,
              services: {
                  sheets: sheetsResult.success,
                  email: emailResult.success,
                  adminEmail: adminEmailResult.success
              }
          });

      } catch (error) {
          console.error('Error processing order:', error);
          res.status(500).json({
              success: false,
              error: 'Failed to process order'
          });
      }
  });

  // Stripe Webhook（決済完了通知）
  app.post('/webhook/stripe', express.raw({type: 'application/json'}), (req, res) => {
      if (!stripeClient || !process.env.STRIPE_WEBHOOK_SECRET) {
          return res.status(400).send('Webhook not configured');
      }

      const sig = req.headers['stripe-signature'];
      let event;

      try {
          event = stripeClient.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
          console.error('Webhook signature verification failed:', err.message);
          return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          console.log('Payment completed for order:', session.metadata.orderId);
          // ここで注文ステータスを更新可能
      }

      res.json({received: true});
  });

  // ヘルスチェック
  app.get('/api/health', (req, res) => {
      res.json({
          status: 'OK',
          services: {
              stripe: !!stripeClient,
              resend: !!resendClient,
              sheets: !!sheetsAuth
          }
      });
  });

  // サービス初期化
  initializeServices();

  app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📧 Health check: http://localhost:${PORT}/api/health`);
  });
