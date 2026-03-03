import TopNav from '@/components/layout/TopNav';
import ChatSidebar from '@/components/layout/ChatSidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopNav />
      <ChatSidebar />
      <main className="pt-0">
        {children}
      </main>
    </div>
  );
}
