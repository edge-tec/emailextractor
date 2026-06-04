'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Download, RefreshCw, Trash2, LogOut, Search, Mail } from 'lucide-react';

interface Lead {
  _id: string;
  sender_email: string;
  created_at: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [domainFilter, setDomainFilter] = useState('');
  const [stats, setStats] = useState({ totalProcessed: 0, duplicateCount: 0 });

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/leads${domainFilter ? `?domain=${domainFilter}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (error) {
      console.error('Failed to fetch leads', error);
    } finally {
      setLoading(false);
    }
  }, [domainFilter]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated') {
      fetchLeads();
    }
  }, [status, router, fetchLeads]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch('/api/emails/sync-senders');
      const data = await res.json();
      if (res.ok) {
        setStats({
          totalProcessed: data.stats.totalProcessed,
          duplicateCount: data.stats.duplicateCount,
        });
        fetchLeads();
      } else {
        alert(data.error || 'Failed to sync');
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred during sync.');
    } finally {
      setSyncing(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to delete all extracted leads?')) return;
    try {
      const res = await fetch('/api/leads/clear', { method: 'DELETE' });
      if (res.ok) {
        setLeads([]);
        setStats({ totalProcessed: 0, duplicateCount: 0 });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleExport = () => {
    window.location.href = '/api/leads/export';
  };

  if (status === 'loading' || (loading && leads.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Mail className="h-6 w-6 text-blue-600 mr-2" />
              <span className="font-bold text-xl text-gray-900">Sender Extractor</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500 hidden sm:block">
                {session?.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        {/* Stats & Actions Header */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Dashboard
            </h2>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Emails'}
            </button>
            <button
              onClick={handleExport}
              disabled={leads.length === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Total Unique Senders</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{leads.length}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Recent Scan - Processed</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalProcessed}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Recent Scan - Duplicates Ignored</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.duplicateCount}</dd>
            </div>
          </div>
        </div>

        {/* Filters & Table */}
        <div className="bg-white shadow rounded-lg border border-gray-200">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 sm:mb-0">
              Extracted Sender Leads
            </h3>
            <div className="flex items-center space-x-4">
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border bg-white text-gray-900"
                  placeholder="Filter by domain (e.g. gmail.com)"
                  value={domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchLeads()}
                />
              </div>
              <button
                onClick={handleClear}
                className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sender Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Extracted Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      No sender emails found. Click "Sync Emails" to start extracting.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {lead.sender_email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(lead.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
