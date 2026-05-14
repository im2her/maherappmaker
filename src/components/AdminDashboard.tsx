import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, doc, setDoc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Search, User as UserIcon, Code, MessageSquare, Settings, ArrowRight, Save } from 'lucide-react';
import clsx from 'clsx';
import { User } from 'firebase/auth';

interface AdminDashboardProps {
  user: User;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
}

export function AdminDashboard({ user, onClose, onSelectChat }: AdminDashboardProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'chats'>('users');
  const [chats, setChats] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [editPlan, setEditPlan] = useState('');
  const [editMessageCount, setEditMessageCount] = useState(0);
  const [editMonthlyMessageCount, setEditMonthlyMessageCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const usersSnap = await getDocs(usersQuery);
      const fetchedUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(fetchedUsers);

      const chatsQuery = query(collection(db, 'chats'), orderBy('updatedAt', 'desc'));
      const chatsSnap = await getDocs(chatsQuery);
      const fetchedChats = chatsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChats(fetchedChats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (u: any) => {
    setSelectedUser(u);
    setEditPlan(u.plan || 'free');
    setEditMessageCount(u.messageCount || 0);
    setEditMonthlyMessageCount(u.monthlyMessageCount || 0);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        plan: editPlan,
        messageCount: editMessageCount,
        monthlyMessageCount: editMonthlyMessageCount,
        updatedAt: serverTimestamp()
      });
      setSelectedUser(null);
      fetchData();
    } catch (e) {
      alert("حدث خطأ أثناء الحفظ");
    }
  };

  const handleResetMessages = async (userId: string) => {
     try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        messageCount: 0,
        updatedAt: serverTimestamp()
      });
      fetchData();
    } catch (e) {
      alert("حدث خطأ أثناء التصفير");
    }
  };

  const handleResetAllMessages = async () => {
    if (confirm('هل أنت متأكد من تصفير الرسائل اليومية لجميع المستخدمين؟')) {
      setLoading(true);
      try {
        const usersSnap = await getDocs(query(collection(db, 'users')));
        const promises = usersSnap.docs.map(userDoc => 
          updateDoc(doc(db, 'users', userDoc.id), {
            messageCount: 0,
            updatedAt: serverTimestamp()
          })
        );
        await Promise.all(promises);
        fetchData();
      } catch (e) {
        alert("حدث خطأ أثناء التصفير الشامل");
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 overflow-y-auto" dir="rtl">
      <header className="bg-zinc-900 border-b border-zinc-800 p-4 sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50">
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-gold-500" />
            لوحة المسؤول
          </h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto hide-scrollbar pb-1 sm:pb-0">
          <button 
            onClick={() => setActiveTab('users')}
            className={clsx("px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0", activeTab === 'users' ? "bg-gold-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700")}
          >
            المستخدمين
          </button>
          <button 
            onClick={() => setActiveTab('chats')}
            className={clsx("px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0", activeTab === 'chats' ? "bg-gold-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700")}
          >
            الدردشات والمشاريع
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-t-2 border-r-2 border-gold-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button 
                    onClick={handleResetAllMessages}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white text-sm px-4 py-2 rounded-lg transition-colors border border-zinc-700"
                  >
                    تصفير اليومي للجميع
                  </button>
                </div>
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                  <div className="overflow-x-auto hide-scrollbar">
                    <table className="w-full text-sm text-right whitespace-nowrap">
                      <thead className="bg-zinc-800/50 text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="px-4 sm:px-6 py-4 font-medium">البريد الإلكتروني</th>
                          <th className="px-4 sm:px-6 py-4 font-medium">الباقة</th>
                          <th className="px-4 sm:px-6 py-4 font-medium">يومي (اليوم/الكل)</th>
                          <th className="px-4 sm:px-6 py-4 font-medium">شهري (المستهلك)</th>
                          <th className="px-4 sm:px-6 py-4 font-medium">آخر تصفير</th>
                          <th className="px-4 sm:px-6 py-4 font-medium">الاشتراكات</th>
                          <th className="px-4 sm:px-6 py-4 font-medium min-w-[200px] text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 sm:px-6 py-4 text-zinc-200" dir="ltr">{u.email}</td>
                            <td className="px-4 sm:px-6 py-4">
                              <span className={clsx("px-2 py-1 rounded-md text-xs font-bold", 
                                u.plan === 'elite' ? "bg-gold-500/20 text-gold-500" :
                                u.plan === 'pro' ? "bg-blue-500/20 text-blue-400" : "bg-zinc-800 text-zinc-400"
                              )}>
                                {u.plan === 'free' ? 'مجانية' : u.plan === 'pro' ? 'احترافية' : 'نخبة'}
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-zinc-300">
                              {u.messageCount || 0} / {u.totalMessages || 0}
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-zinc-300">
                              {u.monthlyMessageCount || 0}
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-zinc-400 text-xs text-center border-l border-zinc-800/20">
                              {u.lastMessageReset?.toDate ? u.lastMessageReset.toDate().toLocaleString('ar-SA') : (u.lastMessageReset?.seconds ? new Date(u.lastMessageReset.seconds * 1000).toLocaleString('ar-SA') : '---')}
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-zinc-400 text-center">{u.subscriptionCount || 0}</td>
                            <td className="px-4 sm:px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleEditUser(u)} className="text-blue-400 bg-blue-400/5 hover:bg-blue-400/20 border border-blue-400/20 px-3 py-1.5 rounded-lg text-xs transition-colors">تعديل الباقة والعدد</button>
                                <button onClick={() => handleResetMessages(u.id)} className="text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded-lg text-xs transition-colors">تصفير</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'chats' && (
              <div className="space-y-4">
                {chats.map(chat => (
                   <div key={chat.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-wrap gap-4 items-center justify-between">
                     <div>
                       <h3 className="text-zinc-200 font-medium mb-1">{chat.title}</h3>
                       <p className="text-xs text-zinc-500">
                         {new Date(chat.updatedAt?.toDate?.() || Date.now()).toLocaleDateString('ar-SA')} - مع {chat.agentName}
                       </p>
                     </div>
                     <div className="flex items-center gap-2">
                       <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-1 rounded-md" dir="ltr">User: {chat.userId.slice(0,6)}...</span>
                       <button 
                         onClick={() => {
                           onSelectChat(chat.id);
                           onClose();
                         }}
                         className="text-xs bg-gold-500 text-zinc-950 px-3 py-1.5 rounded-lg font-bold hover:bg-gold-400 transition-colors"
                       >
                         فتح بملفي
                       </button>
                     </div>
                   </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit User Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
           <div className="bg-zinc-900 border border-zinc-800 max-w-md w-full rounded-2xl p-6">
             <h3 className="text-xl font-bold text-white mb-6">تعديل بيانات المستخدم</h3>
             
             <div className="space-y-4 mb-6">
               <div>
                 <label className="block text-sm text-zinc-400 mb-2">الباقة</label>
                 <select 
                   value={editPlan} 
                   onChange={(e) => setEditPlan(e.target.value)}
                   className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-gold-500"
                 >
                   <option value="free">مجانية</option>
                   <option value="pro">احترافية</option>
                   <option value="elite">نخبة</option>
                 </select>
               </div>
               <div>
                 <label className="block text-sm text-zinc-400 mb-2">استهلاك الرسائل اليومي</label>
                 <input 
                   type="number" 
                   value={editMessageCount} 
                   onChange={(e) => setEditMessageCount(Number(e.target.value))}
                   className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-gold-500"
                 />
               </div>
               <div>
                 <label className="block text-sm text-zinc-400 mb-2">استهلاك الرصيد الشهري</label>
                 <input 
                   type="number" 
                   value={editMonthlyMessageCount} 
                   onChange={(e) => setEditMonthlyMessageCount(Number(e.target.value))}
                   className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-gold-500"
                 />
               </div>
             </div>

             <div className="flex gap-3">
               <button onClick={handleSaveUser} className="flex-1 bg-gold-500 hover:bg-gold-400 text-zinc-950 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                 <Save className="w-4 h-4" />
                 حفظ التعديلات
               </button>
               <button onClick={() => setSelectedUser(null)} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors">
                 إلغاء
               </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
