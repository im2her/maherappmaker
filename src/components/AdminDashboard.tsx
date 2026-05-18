import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, addDoc } from 'firebase/firestore';
import { Search, User as UserIcon, Code, MessageSquare, Settings, ArrowRight, Save, Users, CreditCard, TrendingUp, BarChart, Bell, Send, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { User } from 'firebase/auth';

interface AdminDashboardProps {
  user: User;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
}

interface Broadcast {
  id: string;
  title: string;
  body: string;
  active: boolean;
  createdAt: any;
}

export function AdminDashboard({ user, onClose, onSelectChat }: AdminDashboardProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'chats' | 'broadcasts'>('users');
  const [chats, setChats] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [chatsToDeleteUser, setChatsToDeleteUser] = useState<any>(null);
  
  const [editPlan, setEditPlan] = useState('');
  const [editMessageCount, setEditMessageCount] = useState(0);
  const [editMonthlyMessageCount, setEditMonthlyMessageCount] = useState(0);

  const [newBroadcastTitle, setNewBroadcastTitle] = useState('');
  const [newBroadcastBody, setNewBroadcastBody] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // حساب الإحصائيات
  const stats = {
    totalUsers: users.length,
    activeSubscribers: users.filter(u => u.plan === 'pro' || u.plan === 'elite').length,
    monthlyRevenue: users.reduce((acc, u) => {
      if (u.plan === 'pro') return acc + 150;
      if (u.plan === 'elite') return acc + 250;
      return acc;
    }, 0),
    // تكلفة الاستهلاك التقديرية (بناءً على متوسط 20 ألف توكن للرسالة الواحدة في مهام البرمجة المعقدة)
    // التكلفة التقديرية = (الرسائل هذا الشهر) × 0.015 ريال سعودي
    estimatedCost: users.reduce((acc, u) => acc + (u.monthlyTotalMessages || 0), 0) * 0.015
  };

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

      const broadcastsQuery = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'));
      const broadcastsSnap = await getDocs(broadcastsQuery);
      const fetchedBroadcasts = broadcastsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Broadcast));
      setBroadcasts(fetchedBroadcasts);
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

  const handleDeleteUserChats = async (userId: string) => {
    setLoading(true);
    try {
      const qChats = query(collection(db, 'chats'), where('userId', '==', userId));
      const chatsSnap = await getDocs(qChats);
      
      for (const chatDoc of chatsSnap.docs) {
        // Delete messages subcollection first
        const messagesSnap = await getDocs(collection(db, `chats/${chatDoc.id}/messages`));
        const messagePromises = messagesSnap.docs.map(m => deleteDoc(m.ref));
        await Promise.all(messagePromises);
        
        // Delete the chat itself
        await deleteDoc(chatDoc.ref);
      }
      
      alert('تم حذف جميع المشاريع والرسائل بنجاح.');
      setChatsToDeleteUser(null);
      fetchData();
    } catch (chatError: any) {
      console.error("Error deleting user chats:", chatError);
      handleFirestoreError(chatError, OperationType.DELETE, 'chats');
      alert(`فشل حذف المشاريع: ${chatError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setLoading(true);
    try {
      // Delete all chats belonging to this user
      try {
        const qChats = query(collection(db, 'chats'), where('userId', '==', userId));
        const chatsSnap = await getDocs(qChats);
        
        for (const chatDoc of chatsSnap.docs) {
          // Delete messages subcollection first
          const messagesSnap = await getDocs(collection(db, `chats/${chatDoc.id}/messages`));
          const messagePromises = messagesSnap.docs.map(m => deleteDoc(m.ref));
          await Promise.all(messagePromises);
          
          // Delete the chat itself
          await deleteDoc(chatDoc.ref);
        }
      } catch (chatError) {
        console.error("Error deleting user chats:", chatError);
      }

      // Delete the user document in Firestore
      try {
        const userRef = doc(db, 'users', userId);
        await deleteDoc(userRef);
      } catch (userError: any) {
        console.error("Error deleting user doc:", userError);
        alert(`فشل حذف بيانات المستخدم: ${userError.message}`);
        setLoading(false);
        return;
      }

      // If the admin is deleting their own account, call deleteUser on the Auth instance
      if (user.uid === userId) {
          const { deleteUser, getAuth } = await import('firebase/auth');
          const authUser = getAuth().currentUser;
          if (authUser) {
            try {
              await deleteUser(authUser);
              alert("تم حذف حسابك بنجاح.");
            } catch (authErr) {
              console.error("Error deleting self from Auth:", authErr);
              alert("تم حذف البيانات، لكن لم نتمكن من حذف حسابك من النظام (قد يتطلب إعادة الدخول).");
            }
          }
      } else {
          alert("تم حذف المستخدم وقواعد بياناته بنجاح.");
      }
      
      setUserToDelete(null);
      fetchData();
    } catch (e: any) {
      alert("حدث خطأ أثناء الحذف: " + e.message);
      console.error("General delete error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!newBroadcastTitle.trim() || !newBroadcastBody.trim() || isSendingBroadcast) return;
    setIsSendingBroadcast(true);
    try {
      await addDoc(collection(db, 'broadcasts'), {
        title: newBroadcastTitle.trim(),
        body: newBroadcastBody.trim(),
        active: true,
        createdAt: serverTimestamp()
      });
      setNewBroadcastTitle('');
      setNewBroadcastBody('');
      fetchData();
      alert("تم إرسال الإشعار لجميع المستخدمين بنجاح!");
    } catch (e) {
      alert("خطأ في إرسال الإشعار");
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleToggleBroadcast = async (b: Broadcast) => {
    try {
      await updateDoc(doc(db, 'broadcasts', b.id), {
        active: !b.active
      });
      fetchData();
    } catch (e) {
      alert("خطأ في تحديث الحالة");
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الإشعار؟')) return;
    try {
      await deleteDoc(doc(db, 'broadcasts', id));
      fetchData();
    } catch (e) {
      alert("خطأ في الحذف");
    }
  };

  const broadcastsTab = () => {
    setSearchTerm('');
    setActiveTab('broadcasts');
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
            onClick={() => { setSearchTerm(''); setActiveTab('users'); }}
            className={clsx("px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0", activeTab === 'users' ? "bg-gold-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700")}
          >
            المستخدمين
          </button>
          <button 
            onClick={() => { setSearchTerm(''); setActiveTab('chats'); }}
            className={clsx("px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0", activeTab === 'chats' ? "bg-gold-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700")}
          >
            الدردشات والمشاريع
          </button>
          <button 
            onClick={broadcastsTab}
            className={clsx("px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0", activeTab === 'broadcasts' ? "bg-gold-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700")}
          >
            الإشعارات العامة
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-t-2 border-r-2 border-gold-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 space-y-8">
            {/* بطاقات الإحصائيات */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 shadow-lg">
                <div className="flex items-center gap-4 mb-2 text-gold-500">
                  <div className="p-2 bg-gold-500/10 rounded-lg">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400">إجمالي المسجلين</span>
                </div>
                <div className="text-3xl font-bold text-white">{stats.totalUsers}</div>
              </div>

              <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 shadow-lg">
                <div className="flex items-center gap-4 mb-2 text-blue-400">
                  <div className="p-2 bg-blue-400/10 rounded-lg">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400">المشتركين النشطين</span>
                </div>
                <div className="text-3xl font-bold text-white">{stats.activeSubscribers}</div>
              </div>

              <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 shadow-lg">
                <div className="flex items-center gap-4 mb-2 text-emerald-400">
                  <div className="p-2 bg-emerald-400/10 rounded-lg">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400">الإيرادات الشهرية</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {stats.monthlyRevenue.toLocaleString()} <span className="text-sm text-zinc-500 mr-1">ر.س</span>
                </div>
              </div>

              <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 shadow-lg">
                <div className="flex items-center gap-4 mb-2 text-rose-400">
                  <div className="p-2 bg-rose-400/10 rounded-lg">
                    <BarChart className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400">تكلفة الاستهلاك (تقديري)</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {stats.estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm text-zinc-500 mr-1">ر.س</span>
                </div>
                <p className="text-[10px] text-zinc-600 mt-2">يعتمد على استهلاك محرك "ماهر" الخاص هذا الشهر</p>
              </div>
            </div>

            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      type="text"
                      placeholder="بحث في المستخدمين..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pr-10 pl-4 py-2 text-sm text-white outline-none focus:border-gold-500/50 transition-all"
                    />
                  </div>
                  <button 
                    onClick={handleResetAllMessages}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white text-sm px-4 py-2 rounded-lg transition-colors border border-zinc-700 shadow-lg w-full sm:w-auto"
                  >
                    تصفير اليومي للجميع
                  </button>
                </div>
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
                    <table className="w-full text-sm text-right whitespace-nowrap">
                      <thead className="bg-zinc-800/50 text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="px-6 py-4 font-medium sticky right-0 bg-zinc-900 z-10">البريد الإلكتروني</th>
                          <th className="px-6 py-4 font-medium">رقم الجوال</th>
                          <th className="px-6 py-4 font-medium">الباقة</th>
                          <th className="px-6 py-4 font-medium">يومي (اليوم/الكل)</th>
                          <th className="px-6 py-4 font-medium">شهري (المستهلك)</th>
                          <th className="px-6 py-4 font-medium">آخر تصفير</th>
                          <th className="px-6 py-4 font-medium">الاشتراكات</th>
                          <th className="px-6 py-4 font-medium min-w-[220px] text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {users.filter(u => 
                          u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.phone?.includes(searchTerm) ||
                          u.id?.includes(searchTerm)
                        ).map(u => (
                          <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-6 py-4 text-zinc-200 font-medium sticky right-0 bg-zinc-900/90 group-hover:bg-zinc-800/50 backdrop-blur-sm shadow-xl" dir="ltr">{u.email}</td>
                            <td className="px-6 py-4 text-zinc-300" dir="ltr">{u.phone || '---'}</td>
                            <td className="px-6 py-4">
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
                                <button onClick={() => setChatsToDeleteUser(u)} className="text-orange-400 bg-orange-400/5 hover:bg-orange-400/20 border border-orange-400/20 px-3 py-1.5 rounded-lg text-xs transition-colors">حذف المشاريع</button>
                                <button onClick={() => setUserToDelete(u)} className="text-red-400 bg-red-400/5 hover:bg-red-400/20 border border-red-400/20 px-3 py-1.5 rounded-lg text-xs transition-colors">حذف</button>
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
                <div className="relative w-full sm:w-80 mb-6">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input 
                    type="text"
                    placeholder="بحث في المشاريع..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pr-10 pl-4 py-2 text-sm text-white outline-none focus:border-gold-500/50 transition-all"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {chats.filter(chat => {
                    const chatUser = users.find(u => u.id === chat.userId);
                    return chat.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           chatUser?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           chat.userId.includes(searchTerm);
                  }).map(chat => {
                    const chatUser = users.find(u => u.id === chat.userId);
                    return (
                      <div key={chat.id} className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 flex flex-col gap-4 hover:border-zinc-700 transition-all group shadow-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-zinc-200 font-bold mb-1 group-hover:text-gold-500 transition-colors">{chat.title}</h3>
                            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                              <Code className="w-3.5 h-3.5" />
                              {new Date(chat.updatedAt?.toDate?.() || Date.now()).toLocaleDateString('ar-SA')} - {chat.agentName}
                            </p>
                          </div>
                          <button 
                             onClick={() => {
                               onSelectChat(chat.id);
                               onClose();
                             }}
                             className="text-xs bg-gold-500 text-zinc-950 p-2 rounded-lg font-bold hover:bg-gold-400 transition-colors shadow-lg shadow-gold-500/10"
                             title="فتح بملفي"
                          >
                            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                          </button>
                        </div>
                        
                        <div className="pt-3 border-t border-zinc-800/50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                              <UserIcon className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-zinc-300 font-medium">{chatUser?.fullName || 'مستخدم مجهول'}</span>
                              <span className="text-[10px] text-zinc-500" dir="ltr">{chatUser?.email || '---'}</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-zinc-600 font-mono" dir="ltr">UID: {chat.userId.slice(0,8)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'broadcasts' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Create Broadcast */}
                <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-4 h-fit">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Bell className="w-5 h-5 text-gold-500" />
                    إرسال إشعار جديد للجميع
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">عنوان الإشعار</label>
                      <input 
                        type="text" 
                        value={newBroadcastTitle}
                        onChange={(e) => setNewBroadcastTitle(e.target.value)}
                        placeholder="مثال: عرض خاص جديد! 🎁"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-gold-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">نص الرسالة</label>
                      <textarea 
                        rows={4}
                        value={newBroadcastBody}
                        onChange={(e) => setNewBroadcastBody(e.target.value)}
                        placeholder="اكتب تفاصيل العرض أو التنبيه هنا..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-gold-500 resize-none"
                      />
                    </div>
                    <button 
                      onClick={handleSendBroadcast}
                      disabled={isSendingBroadcast || !newBroadcastTitle.trim() || !newBroadcastBody.trim()}
                      className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-zinc-950 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                      إرسال الآن للجميع
                    </button>
                  </div>
                </div>

                {/* Previous Broadcasts */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white px-2">الإشعارات السابقة</h3>
                  <div className="space-y-3">
                    {broadcasts.map(b => (
                      <div key={b.id} className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="text-zinc-100 font-bold mb-1">{b.title}</h4>
                          <p className="text-sm text-zinc-400 line-clamp-2">{b.body}</p>
                          <span className="text-[10px] text-zinc-600 block mt-2">
                            {b.createdAt?.toDate ? b.createdAt.toDate().toLocaleString('ar-SA') : '---'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => handleToggleBroadcast(b)}
                            className={clsx(
                              "text-[10px] px-2 py-1 rounded-md font-bold transition-colors",
                              b.active ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                            )}
                          >
                            {b.active ? 'نشط' : 'متوقف'}
                          </button>
                          <button 
                            onClick={() => handleDeleteBroadcast(b.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {broadcasts.length === 0 && (
                      <div className="text-center py-12 text-zinc-600 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">
                        لا توجد إشعارات سابقة
                      </div>
                    )}
                  </div>
                </div>
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

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500">
                <Settings className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">حذف المستخدم</h3>
              <p className="text-zinc-400 text-sm mb-6">
                هل أنت متأكد من حذف المستخدم <span className="text-white font-medium" dir="ltr">{userToDelete.email}</span> نهائياً؟ 
                سيتم حذف جميع بياناته ومحادثاته.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button 
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={() => handleDeleteUser(userToDelete.id)}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors border border-red-500/50 disabled:opacity-50"
                >
                  {loading ? 'جاري الحذف...' : 'نعم، احذف المستخدم'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Projects Confirmation Modal */}
      {chatsToDeleteUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative">
            <div className="p-6">
              <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mb-4 text-orange-500">
                <Code className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">حذف المشاريع</h3>
              <p className="text-zinc-400 text-sm mb-6">
                هل أنت متأكد من حذف جميع مشاريع <span className="text-white font-medium" dir="ltr">{chatsToDeleteUser.email}</span>؟ 
                سيتم مسح المحادثات والرسائل فقط مع الحفاظ على الحساب.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button 
                  onClick={() => setChatsToDeleteUser(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={() => handleDeleteUserChats(chatsToDeleteUser.id)}
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors border border-orange-500/50 disabled:opacity-50"
                >
                  {loading ? 'جاري الحذف...' : 'نعم، احذف المشاريع'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
