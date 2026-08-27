// Route table. HashRouter is configured in main.jsx so deep links work on
// GitHub Pages without server-side rewrites. Wizard flow:
//   audience (/) -> dimension (/dimension/:slug) -> review -> documents
//                -> conformance (Pathway B and C only) -> download
//
// The last three were one /export page until the release bundle was split by verb:
// authoring, verification, and delivery were competing for one tab strip, and a
// Pathway-A user had to read past both of the others to reach their files.
// /export is kept as a redirect — it is the URL every earlier deep link uses.

import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import StartingPoint from './routes/StartingPoint.jsx';
import AudienceSelector from './routes/AudienceSelector.jsx';
import DimensionPage from './routes/DimensionPage.jsx';
import Review from './routes/Review.jsx';
import Documents from './routes/Documents.jsx';
import Conformance from './routes/Conformance.jsx';
import DownloadPage from './routes/Download.jsx';
import References from './routes/References.jsx';
import Examples from './routes/Examples.jsx';
import Guide from './routes/Guide.jsx';
import Validators from './routes/Validators.jsx';

// The six /export tabs did not all become one page, so a saved link has to be
// routed by which tab it named: the two report tabs were delivery, the ladder tab
// was verification, and the rest were authoring.
const EXPORT_TAB_ROUTE = {
  conformance: '/conformance',
  report: '/download',
};

function ExportRedirect() {
  const { search } = useLocation();
  const tab = new URLSearchParams(search).get('tab');
  const target = EXPORT_TAB_ROUTE[tab] ?? `/documents${tab ? `?tab=${tab}` : ''}`;
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<StartingPoint />} />
        <Route path="audience" element={<AudienceSelector />} />
        <Route path="dimension/:slug" element={<DimensionPage />} />
        <Route path="review" element={<Review />} />
        <Route path="documents" element={<Documents />} />
        <Route path="conformance" element={<Conformance />} />
        <Route path="download" element={<DownloadPage />} />
        <Route path="export" element={<ExportRedirect />} />
        <Route path="references" element={<References />} />
        <Route path="examples" element={<Examples />} />
        <Route path="guide" element={<Guide />} />
        <Route path="validators" element={<Validators />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
