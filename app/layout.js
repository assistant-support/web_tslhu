export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import Layout_Login from '@/app/(auth)/login';
import Nav from '@/components/(layout)/nav';
import '@/styles/all.css'
import air from './layout.module.css'
import { Data_account, Get_user } from '@/data/users';

export const metadata = {
  title: "AI Robotic",
  description: "Khóa học công nghệ cho trẻ"
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.token)?.value;
  const response = await fetch(`${process.env.URL}/api/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ source: 1 }),
    cache: 'no-store'
  });
  let data = null;
  const result = await response.json();
  if (result.status === 2) { data = result.data }
  console.log(await Data_account());
  
  return (
    <html lang="en">
      <body>
        {data ?
          <div className={air.layout}>
            <div className={air.nav}>
              <Nav data={data} />
            </div>
            <div className={air.main}>
              {children}
            </div>
          </div> :
          <Layout_Login />}
      </body>
    </html>
  );
}