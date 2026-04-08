import React, { useState } from 'react';
import { IC } from '../../icons.jsx';
import GlobalStyles from '../../styles.jsx';

const S = {
  page:    { minHeight:'100vh', background:'var(--cream)', fontFamily:"'DM Sans',sans-serif" },
  nav:     { background:'var(--forest)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', height:60, position:'sticky', top:0, zIndex:200 },
  logo:    { fontFamily:"'Cormorant Garamond',serif", fontSize:'1.5rem', fontWeight:300, color:'var(--gold-light)', letterSpacing:'0.08em', cursor:'pointer', textDecoration:'none' },
  body:    { maxWidth:780, margin:'0 auto', padding:'48px 32px 80px' },
  h1:      { fontFamily:"'Cormorant Garamond',serif", fontSize:'2.4rem', fontWeight:400, color:'var(--forest)', marginBottom:8 },
  h2:      { fontFamily:"'Cormorant Garamond',serif", fontSize:'1.4rem', fontWeight:600, color:'var(--forest)', marginTop:36, marginBottom:10, paddingBottom:8, borderBottom:'1px solid var(--parchment)' },
  p:       { fontSize:'0.92rem', color:'var(--mid)', lineHeight:1.85, marginBottom:14 },
  li:      { fontSize:'0.92rem', color:'var(--mid)', lineHeight:1.85, marginBottom:6 },
  updated: { fontSize:'0.78rem', color:'var(--light)', marginBottom:40, fontStyle:'italic' },
  tab:     { background:'none', border:'none', padding:'10px 20px', fontFamily:"'DM Sans',sans-serif", fontSize:'0.88rem', fontWeight:500, cursor:'pointer', borderBottom:'2px solid transparent', transition:'all 0.15s' },
  tabWrap: { display:'flex', borderBottom:'1px solid var(--parchment)', marginBottom:40, background:'var(--white)', borderRadius:'12px 12px 0 0', overflow:'hidden' },
};

const UPDATED = 'Last updated: April 2025';
const CONTACT = 'dawidwille9@gmail.com';
const SITE    = 'vowfinds.co.za';

function TermsContent() {
  return (
    <>
      <h1 style={S.h1}>Terms of Service</h1>
      <p style={S.updated}>{UPDATED}</p>

      <p style={S.p}>Welcome to VowFinds. By accessing or using our platform at {SITE}, you agree to be bound by these Terms of Service. Please read them carefully before using the platform.</p>

      <h2 style={S.h2}>1. About VowFinds</h2>
      <p style={S.p}>VowFinds is a wedding vendor marketplace that connects couples planning their wedding with professional wedding service providers ("Vendors") in the Boland region of South Africa. VowFinds is operated as a South African business.</p>

      <h2 style={S.h2}>2. Who May Use the Platform</h2>
      <p style={S.p}>You must be at least 18 years of age to use VowFinds. By registering an account you confirm that you are 18 or older and that all information you provide is accurate and truthful.</p>
      <p style={S.p}>VowFinds has two types of accounts:</p>
      <ul style={{paddingLeft:24, marginBottom:14}}>
        <li style={S.li}><strong>Customer accounts</strong> — for couples and individuals planning a wedding who wish to browse vendors and request quotes.</li>
        <li style={S.li}><strong>Vendor accounts</strong> — for professional wedding service providers who wish to list their business and receive enquiries.</li>
      </ul>

      <h2 style={S.h2}>3. Vendor Listings and Subscriptions</h2>
      <p style={S.p}>Vendors may list their business on VowFinds subject to the following:</p>
      <ul style={{paddingLeft:24, marginBottom:14}}>
        <li style={S.li}>New vendors receive a free trial period as communicated at the time of registration.</li>
        <li style={S.li}>After the free trial period, continued listing requires a paid subscription at the rate communicated to the vendor at the time of billing.</li>
        <li style={S.li}>Current subscription pricing is available on request by contacting us at {CONTACT}.</li>
        <li style={S.li}>Subscription fees are billed via PayFast and are non-refundable except where required by South African consumer law.</li>
        <li style={S.li}>VowFinds reserves the right to change subscription pricing with 30 days' written notice to existing subscribers.</li>
        <li style={S.li}>Vendor listings may be suspended or removed if payment is not received after the due date.</li>
      </ul>

      <h2 style={S.h2}>4. Vendor Responsibilities</h2>
      <p style={S.p}>Vendors are solely responsible for:</p>
      <ul style={{paddingLeft:24, marginBottom:14}}>
        <li style={S.li}>The accuracy of all information in their profile, including pricing, availability, location and service descriptions.</li>
        <li style={S.li}>Delivering services to customers as agreed. VowFinds is a marketplace only and is not a party to any contract between a vendor and a customer.</li>
        <li style={S.li}>Holding all required business registrations, licences and insurance applicable to their trade in South Africa.</li>
        <li style={S.li}>Maintaining professional conduct in all communications via the platform.</li>
      </ul>

      <h2 style={S.h2}>5. Customer Responsibilities</h2>
      <p style={S.p}>Customers agree to:</p>
      <ul style={{paddingLeft:24, marginBottom:14}}>
        <li style={S.li}>Provide accurate information when requesting quotes.</li>
        <li style={S.li}>Communicate respectfully with vendors through the platform.</li>
        <li style={S.li}>Understand that VowFinds does not guarantee the availability, quality or suitability of any vendor listed on the platform.</li>
      </ul>

      <h2 style={S.h2}>6. No Warranty</h2>
      <p style={S.p}>VowFinds provides the platform on an "as is" and "as available" basis. We do not warrant that the platform will be uninterrupted, error-free or free of viruses. We do not endorse, verify or guarantee any vendor listed on the platform.</p>
      <p style={S.p}>Pricing shown on vendor profiles is indicative only. Final pricing is agreed directly between the customer and vendor.</p>

      <h2 style={S.h2}>7. Limitation of Liability</h2>
      <p style={S.p}>To the maximum extent permitted by South African law, VowFinds shall not be liable for any indirect, incidental or consequential damages arising from your use of the platform, including but not limited to disputes between customers and vendors, loss of bookings or dissatisfaction with vendor services.</p>

      <h2 style={S.h2}>8. Intellectual Property</h2>
      <p style={S.p}>All content on VowFinds, including the logo, design and software, is the property of VowFinds. Vendor profile content (photos, descriptions, pricing) remains the intellectual property of the respective vendor. By uploading content to VowFinds, vendors grant VowFinds a non-exclusive, royalty-free licence to display that content on the platform for the purpose of operating the marketplace.</p>

      <h2 style={S.h2}>9. Termination</h2>
      <p style={S.p}>VowFinds reserves the right to suspend or terminate any account at any time if these Terms are violated. Vendors may cancel their subscription at any time; access will continue until the end of the current billing period.</p>

      <h2 style={S.h2}>10. Governing Law</h2>
      <p style={S.p}>These Terms are governed by the laws of the Republic of South Africa. Any disputes shall be subject to the jurisdiction of the South African courts.</p>

      <h2 style={S.h2}>11. Changes to These Terms</h2>
      <p style={S.p}>VowFinds may update these Terms from time to time. We will notify registered users of material changes by email. Continued use of the platform after changes constitutes acceptance of the updated Terms.</p>

      <h2 style={S.h2}>12. Contact</h2>
      <p style={S.p}>Questions about these Terms? Contact us at <a href={`mailto:${CONTACT}`} style={{color:'var(--rose)'}}>{CONTACT}</a>.</p>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <h1 style={S.h1}>Privacy Policy</h1>
      <p style={S.updated}>{UPDATED}</p>

      <p style={S.p}>VowFinds is committed to protecting your personal information in accordance with the Protection of Personal Information Act, 4 of 2013 (POPIA). This Privacy Policy explains what information we collect, how we use it and your rights regarding your data.</p>

      <h2 style={S.h2}>1. Who We Are (Responsible Party)</h2>
      <p style={S.p}>VowFinds operates {SITE} and is the Responsible Party as defined under POPIA. For any privacy-related queries, contact us at <a href={`mailto:${CONTACT}`} style={{color:'var(--rose)'}}>{CONTACT}</a>.</p>

      <h2 style={S.h2}>2. Information We Collect</h2>
      <p style={S.p}>We collect the following categories of personal information:</p>
      <ul style={{paddingLeft:24, marginBottom:14}}>
        <li style={S.li}><strong>Account information</strong> — your name and email address when you register.</li>
        <li style={S.li}><strong>Vendor profile information</strong> — business name, location, description, pricing, images and Instagram handle.</li>
        <li style={S.li}><strong>Communication data</strong> — messages exchanged between customers and vendors via the platform chat feature.</li>
        <li style={S.li}><strong>Quote request data</strong> — details you provide when requesting a quote from a vendor, including wedding date, venue and budget.</li>
        <li style={S.li}><strong>Usage data</strong> — pages visited, searches performed and features used, collected to improve the platform.</li>
        <li style={S.li}><strong>Payment data</strong> — subscription payments are processed by PayFast. VowFinds does not store your card details.</li>
      </ul>

      <h2 style={S.h2}>3. How We Use Your Information</h2>
      <p style={S.p}>We use your personal information to:</p>
      <ul style={{paddingLeft:24, marginBottom:14}}>
        <li style={S.li}>Create and manage your account.</li>
        <li style={S.li}>Display vendor profiles to prospective customers.</li>
        <li style={S.li}>Facilitate quote requests and communication between customers and vendors.</li>
        <li style={S.li}>Process subscription payments via PayFast.</li>
        <li style={S.li}>Send transactional emails such as email verification and lead notifications.</li>
        <li style={S.li}>Improve the platform through analysis of aggregated, anonymised usage data.</li>
      </ul>
      <p style={S.p}>We do not sell your personal information to third parties. We do not use your information for unsolicited marketing without your consent.</p>

      <h2 style={S.h2}>4. Information Shared With Third Parties</h2>
      <p style={S.p}>We share personal information only with the following service providers who help us operate the platform:</p>
      <ul style={{paddingLeft:24, marginBottom:14}}>
        <li style={S.li}><strong>Supabase</strong> — database and authentication hosting (servers located in Europe).</li>
        <li style={S.li}><strong>Vercel</strong> — website hosting (servers located in the United States).</li>
        <li style={S.li}><strong>Resend</strong> — transactional email delivery.</li>
        <li style={S.li}><strong>PayFast</strong> — payment processing for vendor subscriptions.</li>
        <li style={S.li}><strong>Google</strong> — Maps and Places API for venue search and distance calculations.</li>
      </ul>
      <p style={S.p}>All third parties are required to handle your data in accordance with applicable data protection laws.</p>

      <h2 style={S.h2}>5. Cross-Border Transfers</h2>
      <p style={S.p}>Some of our service providers process data outside South Africa (including in the European Union and United States). Where this occurs, we ensure that appropriate safeguards are in place as required by POPIA and applicable international data protection frameworks.</p>

      <h2 style={S.h2}>6. How Long We Keep Your Data</h2>
      <p style={S.p}>We retain your personal information for as long as your account is active and for a reasonable period thereafter for legal and operational purposes. You may request deletion of your account and associated data at any time by contacting us at {CONTACT}.</p>

      <h2 style={S.h2}>7. Your Rights Under POPIA</h2>
      <p style={S.p}>As a data subject under POPIA, you have the right to:</p>
      <ul style={{paddingLeft:24, marginBottom:14}}>
        <li style={S.li}>Access the personal information we hold about you.</li>
        <li style={S.li}>Request correction of inaccurate information.</li>
        <li style={S.li}>Request deletion of your personal information (subject to legal retention requirements).</li>
        <li style={S.li}>Object to the processing of your personal information.</li>
        <li style={S.li}>Lodge a complaint with the Information Regulator of South Africa at <a href="https://inforegulator.org.za" target="_blank" rel="noreferrer" style={{color:'var(--rose)'}}>inforegulator.org.za</a>.</li>
      </ul>
      <p style={S.p}>To exercise any of these rights, email us at <a href={`mailto:${CONTACT}`} style={{color:'var(--rose)'}}>{CONTACT}</a>. We will respond within 30 days.</p>

      <h2 style={S.h2}>8. Cookies and Tracking</h2>
      <p style={S.p}>VowFinds uses browser session storage and local storage to maintain your login session and remember your preferences. We do not use third-party advertising cookies. No data is shared with advertising networks.</p>

      <h2 style={S.h2}>9. Security</h2>
      <p style={S.p}>We implement reasonable technical and organisational measures to protect your personal information against unauthorised access, loss or disclosure. These include encrypted data transmission (HTTPS), secure database hosting and restricted access to personal data.</p>

      <h2 style={S.h2}>10. Children's Privacy</h2>
      <p style={S.p}>VowFinds is not intended for use by persons under the age of 18. We do not knowingly collect personal information from minors. If you believe a minor has provided us with personal information, please contact us immediately.</p>

      <h2 style={S.h2}>11. Changes to This Policy</h2>
      <p style={S.p}>We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify registered users of material changes by email. The updated policy will be posted on this page with a revised date.</p>

      <h2 style={S.h2}>12. Contact the Information Officer</h2>
      <p style={S.p}>For any privacy-related queries or complaints, contact our Information Officer at <a href={`mailto:${CONTACT}`} style={{color:'var(--rose)'}}>{CONTACT}</a>.</p>
    </>
  );
}

export default function LegalPage({ initialTab = 'terms', onClose }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <>
      <GlobalStyles/>
      <div style={S.page}>
        {/* Nav */}
        <nav style={S.nav}>
          <span onClick={onClose}
            style={{...S.logo, display:'flex', alignItems:'center', gap:10}}>
            {IC.back(16, 'var(--gold-light)')}
            <span>Vow<span style={{color:'var(--blush)', fontStyle:'italic'}}>Finds</span></span>
          </span>
          <span style={{fontSize:'0.78rem', color:'rgba(255,255,255,0.5)'}}>Legal</span>
        </nav>

        <div style={S.body}>
          {/* Tab switcher */}
          <div style={S.tabWrap}>
            {[['terms','Terms of Service'],['privacy','Privacy Policy']].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)}
                style={{...S.tab,
                  borderBottom:`2px solid ${tab===id?'var(--rose)':'transparent'}`,
                  color:tab===id?'var(--rose)':'var(--mid)',
                  background:tab===id?'rgba(196,130,106,0.04)':'none',
                  flex:1}}>
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          {tab==='terms' ? <TermsContent/> : <PrivacyContent/>}
        </div>

        {/* Footer */}
        <div style={{background:'var(--forest)', padding:'24px 32px', textAlign:'center'}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif", fontSize:'1.1rem', color:'var(--gold-light)', marginBottom:6}}>
            Vow<span style={{color:'var(--blush)', fontStyle:'italic'}}>Finds</span>
          </div>
          <p style={{fontSize:'0.76rem', color:'rgba(255,255,255,0.45)', margin:0}}>
            © 2025 VowFinds · {SITE} · <a href={`mailto:${CONTACT}`} style={{color:'rgba(255,255,255,0.45)'}}>{CONTACT}</a>
          </p>
        </div>
      </div>
    </>
  );
}

export { LegalPage };
